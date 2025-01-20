import { Tool } from "langchain/tools";
import { SolanaAgentKit } from "solana-agent-kit";
import axios from "axios";
import { PublicKey } from "@solana/web3.js";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { ToolRunnableConfig } from "@langchain/core/tools";

// Constants for API endpoints and rate limiting
const DEXSCREENER_API_BASE = 'https://api.dexscreener.com/latest';
const RATE_LIMIT_MS = 1000; // 1 second between requests

// Cache implementation for token data
const tokenDataCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface TokenData {
  extensions: any;
  symbol: string;
  name: string;
  address: string;
  price: number;
  volume24h: number;
  liquidity: number;
  priceChange24h: number;
  marketCap?: number;
  pairs?: {
    dexId: string;
    pairAddress: string;
    baseToken: {
      address: string;
      name: string;
      symbol: string;
    };
    quoteToken: {
      address: string;
      name: string;
      symbol: string;
    };
    priceUsd: number;
    volume24h: number;
    liquidity: number;
  }[];
}

// Rate limiter implementation
let lastRequestTime = 0;
async function rateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
}

// Helper function to check cache
function getCachedData(key: string): TokenData | null {
  const cached = tokenDataCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

// Helper function to set cache
function setCachedData(key: string, data: TokenData) {
  tokenDataCache.set(key, {
    data,
    timestamp: Date.now()
  });
}

declare module "solana-agent-kit" {
  interface SolanaAgentKit {
    getTokenDataByTicker(ticker: string): Promise<TokenData>;
  }
}

export class SolanaTokenDataByTickerTool extends Tool {
  protected _call(arg: any, runManager?: CallbackManagerForToolRun, parentConfig?: ToolRunnableConfig): Promise<any> {
    throw new Error("Method not implemented.");
  }
  name = "solana_token_data_by_ticker";
  description = `Get the token data for a given token ticker Inputs: ticker is required. ticker: string, eg "USDC" (required)`;

  constructor(private solanaKit: SolanaAgentKit) {
    super();
  }

  async call(input: string): Promise<string> {
    try {
      const ticker = input.trim();
      const tokenData = await this.solanaKit.getTokenDataByTicker(ticker);
      return JSON.stringify({
        status: "success",
        tokenData,
      });
    } catch (error: any) {
      return JSON.stringify({
        status: "error",
        message: error.message,
        code: error.code || "UNKNOWN_ERROR",
      });
    }
  }
}

export async function getTokenDataByAddress(address: PublicKey): Promise<TokenData> {
  try {
    // Check cache first
    const cached = getCachedData(address.toString());
    if (cached) {
      return cached;
    }

    // Apply rate limiting
    await rateLimit();

    // Fetch token data from DexScreener
    const response = await axios.get(`${DEXSCREENER_API_BASE}/tokens/solana/${address.toString()}`);
    
    if (!response.data || !response.data.pairs || response.data.pairs.length === 0) {
      throw new Error('Token not found or no trading pairs available');
    }

    // Process and format the data
    const pairs = response.data.pairs;
    const mostLiquidPair = pairs.reduce((a: any, b: any) => 
      (a.liquidity || 0) > (b.liquidity || 0) ? a : b
    );

    const tokenData: TokenData = {
      symbol: mostLiquidPair.baseToken.symbol,
      name: mostLiquidPair.baseToken.name,
      address: address.toString(),
      price: mostLiquidPair.priceUsd || 0,
      volume24h: pairs.reduce((sum: number, pair: any) => sum + (pair.volume24h || 0), 0),
      liquidity: pairs.reduce((sum: number, pair: any) => sum + (pair.liquidity || 0), 0),
      priceChange24h: mostLiquidPair.priceChange24h || 0,
      marketCap: mostLiquidPair.marketCap,
      pairs: pairs.map((pair: any) => ({
        dexId: pair.dexId,
        pairAddress: pair.pairAddress,
        baseToken: pair.baseToken,
        quoteToken: pair.quoteToken,
        priceUsd: pair.priceUsd,
        volume24h: pair.volume24h,
        liquidity: pair.liquidity
      })),
      extensions: undefined
    };

    // Cache the result
    setCachedData(address.toString(), tokenData);

    return tokenData;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch token data: ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
}

export async function getTokenDataByTicker(ticker: string): Promise<TokenData> {
  try {
    // Check cache first
    const cached = getCachedData(ticker.toUpperCase());
    if (cached) {
      return cached;
    }

    // Apply rate limiting
    await rateLimit();

    // Search for token by ticker
    const response = await axios.get(`${DEXSCREENER_API_BASE}/search?q=${ticker}`);
    
    if (!response.data || !response.data.pairs || response.data.pairs.length === 0) {
      throw new Error(`No token found for ticker: ${ticker}`);
    }

    // Filter for Solana tokens only and find the most liquid pair
    const solanaPairs = response.data.pairs.filter((pair: any) => pair.chainId === 'solana');
    if (solanaPairs.length === 0) {
      throw new Error(`No Solana token found for ticker: ${ticker}`);
    }

    // Get token data using the address from the most liquid pair
    const mostLiquidPair = solanaPairs.reduce((a: any, b: any) => 
      (a.liquidity || 0) > (b.liquidity || 0) ? a : b
    );

    const tokenAddress = new PublicKey(mostLiquidPair.baseToken.address);
    return await getTokenDataByAddress(tokenAddress);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch token data: ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
}

// Static method for getting token price
export function getTokenPrice(tokenData: TokenData): number {
  return tokenData.price || 0;
}