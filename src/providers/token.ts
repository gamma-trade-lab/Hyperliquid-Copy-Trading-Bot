import { ICacheManager, settings } from "@elizaos/core";
import { IAgentRuntime } from "@elizaos/core";
import {
    DexScreenerData,
    DexScreenerPair,
    ProcessedTokenData,
    TokenSecurityData,
    TokenTradeData,
    CalculatedBuyAmounts,
} from "../types/token.js";
import NodeCache from "node-cache";
import * as path from "path";
import { toBN } from "../utils/bignumber.js";
import { WalletProvider, Item } from "./wallet.js";
import { PublicKey } from "@solana/web3.js";
import { elizaLogger } from "@ai16z/eliza";
import { Tool } from "@goat-sdk/core";
import {
    GetPairsByChainAndPairParameters,
    SearchPairsParameters,
    GetTokenPairsParameters
} from "./dexParameters.js"; // Import dexParameters
import { JupiterTokenData } from "solana-agent-kit";

const PROVIDER_CONFIG = {
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000,
    DEFAULT_RPC: "https://api.mainnet-beta.solana.com",
    TOKEN_ADDRESSES: {
        SOL: "So11111111111111111111111111111111111111112",
        BTC: "qfnqNqs3nCAHjnyCgLRDbBtq4p2MtHZxw8YjSyYhPoL",
        ETH: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs"
    },
    HEADERS: {
        'Accept': 'application/json',
        'x-chain': 'solana'
    }
};

interface TokenTradeResponse {
    address: string;
    holder: { total: number; changes: any[] };
    market: { price: number; volume: number };
    last_trade_unix_time: number;
    last_trade_human_time: string;
    price: number;
    [key: string]: any; // For all the dynamic trade data fields
}

export class TokenProvider {
    
    private tokenAddress: string; // Remove readonly modifier
    private readonly DEFAULT_HEADERS = {
        'accept': 'application/json',
        'x-chain': 'solana'
    };
    private readonly ENDPOINTS = {
        DEX_SCREENER: '/defi/dexscreener'
    };
    private cache: NodeCache;
    private cacheKey: string = "solana/tokens";
    private apiKey: string;
    config: any;

    constructor(
        tokenAddress: string = PROVIDER_CONFIG.TOKEN_ADDRESSES.SOL, // Default to SOL if no address is provided
        public walletProvider: WalletProvider,
        private cacheManager: ICacheManager,
        config: { apiKey: string; retryAttempts?: number; retryDelay?: number; timeout?: number }
    ) {
        this.tokenAddress = tokenAddress;
        this.apiKey = config.apiKey;
        this.config = {
            retryAttempts: config.retryAttempts ?? 3,
            retryDelay: config.retryDelay ?? 2000,
            timeout: config.timeout ?? 10000,
            ...config
        };
        elizaLogger.info(`TokenProvider initialized with config: ${JSON.stringify(this.config)}`);
        this.validateApiKey();
        this.cache = new NodeCache({ stdTTL: 300 }); // 5 minutes cache
    }

    // Add a method to set the token address dynamically
    public setTokenAddress(tokenAddress: string): void {
        if (!tokenAddress) {
            throw new Error("Token address is required");
        }
        this.tokenAddress = tokenAddress;
    }

    private async validateConfig<T>(key: string) {
        if (!this.config.apiKey) {
            const cached = await this.cacheManager.get<T>(
                path.join(this.cacheKey, key)
            );
            return cached || null;
        }
    }

    private async writeToCache<T>(key: string, data: T): Promise<void> {
        await this.cacheManager.set(path.join(this.cacheKey, key), data, {
            expires: Date.now() + 5 * 60 * 1000,
        });
    }

    private async getCachedData(key: string): Promise<any> {
        try {
          const cached = await this.cache.get(key);
          return cached ? JSON.parse(cached as string) : null;
        } catch (error) {
          elizaLogger.error('Cache error:', error);
          return null;
        }
      }

    private async setCachedData<T>(cacheKey: string, data: T): Promise<void> {
        // Set in-memory cache
        this.cache.set(cacheKey, data);

        // Write to file-based cache
        await this.writeToCache(cacheKey, data);
    }

    private async fetchWithRetry<T>(url: string): Promise<T> {
        const { retryAttempts, retryDelay, timeout } = this.config;
        elizaLogger.info(`Using config - retryAttempts: ${retryAttempts}, retryDelay: ${retryDelay}, timeout: ${timeout}`);
    
        if (retryAttempts === undefined) {
            throw new Error('retryAttempts is undefined');
        }
    
        const maxRetries = retryAttempts ?? 3;
        const baseDelay = retryDelay ?? 2000;
        const requestTimeout = timeout ?? 10000;
    
        let lastError: Error | null = null;
    
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), requestTimeout);
    
                elizaLogger.info(`Attempting to fetch URL: ${url}, Attempt: ${attempt}`);
                const response = await fetch(url, {
                    method: 'GET',
                    headers: new Headers({
                        ...this.DEFAULT_HEADERS,
                        'X-API-KEY': this.config.apiKey
                    }),
                    signal: controller.signal
                });
    
                clearTimeout(timeoutId);
    
                // Check response content type
                const contentType = response.headers.get('content-type');
                if (contentType?.includes('text/html')) {
                    throw new Error('Invalid API response: received HTML instead of JSON');
                }
    
                if (response.status === 404) {
                    throw new Error('Resource not found (404)');
                }
    
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                }
    
                const data = await response.json();
                
                if (!data.success) {
                    throw new Error(data.error || 'API request failed');
                }
    
                return data as T;
    
            } catch (error) {
                lastError = error as Error;
                elizaLogger.warn(`Attempt ${attempt} failed:`, error);
    
                if (attempt < maxRetries) {
                    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 10000);
                    elizaLogger.info(`Waiting ${delay}ms before retrying...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
    
        throw lastError || new Error('Request failed after all retry attempts');
    }

    // Add API key validation helper
    private validateApiKey(): void {
        if (!settings.HELIUS_API_KEY) {
            throw new Error('HELIUS_API_KEY is required for holder data. Please set it in your environment variables.');
        }
    }

    async getTokensInWallet(runtime: IAgentRuntime): Promise<Item[]> {
        const walletInfo =
            await this.walletProvider.fetchPortfolioValue(runtime);
        const items = walletInfo.items;
        return items;
    }

    // check if the token symbol is in the wallet
    async getTokenFromWallet(runtime: IAgentRuntime, tokenSymbol: string) {
        try {
            const items = await this.getTokensInWallet(runtime);
            const token = items.find((item) => item.symbol === tokenSymbol);

            if (token) { 
                return token.address;
            } else {
                return null;
            }
        } catch (error) {
            console.error("Error checking token in wallet:", error);
            return null;
        }
    }

    async fetchDexScreenerData(): Promise<DexScreenerData> {
        if (!this.tokenAddress) {
            throw new Error("Token address is required");
        }
        const url = `https://api.dexscreener.com/token-profiles/latest/v1`;
        try {
            console.log(`Fetching latest token profiles from DexScreener`);
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            const data = await response.json();

            // Assuming the response structure matches DexScreenerData
            const dexData: DexScreenerData = {
                schemaVersion: "1.0.0",
                pairs: data.pairs || [],
            };

            return dexData;
        } catch (error) {
            console.error(`Error fetching DexScreener data:`, error);
            return {
                schemaVersion: "1.0.0",
                pairs: [],
            };
        }
    }

    async calculateBuyAmounts(): Promise<CalculatedBuyAmounts> {
        const dexScreenerData = await this.fetchDexScreenerData();
        const solPrice = toBN("0"); // Placeholder for SOL price

        if (!dexScreenerData || dexScreenerData.pairs.length === 0) {
            return { none: 0, low: 0, medium: 0, high: 0 };
        }

        // Get the first pair
        const pair = dexScreenerData.pairs[0];
        const { liquidity, marketCap } = pair;
        if (!liquidity || !marketCap) {
            return { none: 0, low: 0, medium: 0, high: 0 };
        }

        if (liquidity.usd === 0 || marketCap < 100000) {
            return { none: 0, low: 0, medium: 0, high: 0 };
        }

        // impact percentages based on liquidity
        const impactPercentages = {
            LOW: 0.01, // 1% of liquidity
            MEDIUM: 0.05, // 5% of liquidity
            HIGH: 0.1, // 10% of liquidity
        };

        // Calculate buy amounts in USD
        const lowBuyAmountUSD = liquidity.usd * impactPercentages.LOW;
        const mediumBuyAmountUSD = liquidity.usd * impactPercentages.MEDIUM;
        const highBuyAmountUSD = liquidity.usd * impactPercentages.HIGH;

        // Convert each buy amount to SOL
        const lowBuyAmountSOL = toBN(lowBuyAmountUSD).div(solPrice).toNumber();
        const mediumBuyAmountSOL = toBN(mediumBuyAmountUSD)
            .div(solPrice)
            .toNumber();
        const highBuyAmountSOL = toBN(highBuyAmountUSD)
            .div(solPrice)
            .toNumber();

        return {
            none: 0,
            low: lowBuyAmountSOL,
            medium: mediumBuyAmountSOL,
            high: highBuyAmountSOL,
        };
    }

    async fetchTokenSecurity(): Promise<TokenSecurityData> {
        if (!this.tokenAddress) {
            throw new Error("Token address is required");
        }

        const cacheKey = `tokenSecurity_${this.tokenAddress}`;
        const cachedData = await this.getCachedData(cacheKey);
        if (cachedData) {
            console.log(
                `Returning cached token security data for ${this.tokenAddress}.`
            );
            return cachedData;
        }

        const url = `https://api.helius.xyz/v0/tokens/${this.tokenAddress}/security`;
        const response = await this.fetchWithRetry<TokenSecurityData>(url);

        if (!response) {
            throw new Error("No token security data available");
        }

        await this.setCachedData(cacheKey, response);
        console.log(`Token security data cached for ${this.tokenAddress}.`);

        return response;
    }

    async fetchTokenTradeData(): Promise<TokenTradeData> {
        if (!this.tokenAddress) {
            throw new Error("Token address is required");
        }

        const cacheKey = `tokenTradeData_${this.tokenAddress}`;
        const cachedData = await this.getCachedData(cacheKey);
        if (cachedData) {
            console.log(
                `Returning cached token trade data for ${this.tokenAddress}.`
            );
            return cachedData;
        }

        const url = `https://api.helius.xyz/v0/tokens/${this.tokenAddress}/trades`;
        const response = await this.fetchWithRetry<TokenTradeData>(url);

        if (!response) {
            throw new Error("No token trade data available");
        }

        await this.setCachedData(cacheKey, response);
        console.log(`Token trade data cached for ${this.tokenAddress}.`);

        return response;
    }

    // Add a method to get a formatted token report
    public async getFormattedTokenReport(): Promise<string> {
        const dexScreenerData = await this.fetchDexScreenerData();
        const buyAmounts = await this.calculateBuyAmounts();
        const tokenSecurity = await this.fetchTokenSecurity();
        const tokenTradeData = await this.fetchTokenTradeData();

        return `
        Token Report for ${this.tokenAddress}:
        - Market Cap: ${dexScreenerData.pairs[0]?.marketCap || 'N/A'}
        - Liquidity: ${dexScreenerData.pairs[0]?.liquidity?.usd || 'N/A'}
        - Buy Amounts: Low: ${buyAmounts.low}, Medium: ${buyAmounts.medium}, High: ${buyAmounts.high}
        - Security: Owner Balance: ${tokenSecurity.ownerBalance}, Creator Balance: ${tokenSecurity.creatorBalance}
        - Last Trade: ${tokenTradeData.last_trade_human_time}, Price: $${tokenTradeData.price}
        `;
    }

    // Add a method to search DexScreener data
    public async searchDexScreenerData(query: string): Promise<DexScreenerPair[] | null> {
        const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
        try {
            console.log(`Searching DexScreener data for query: ${query}`);
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            const data = await response.json() as { schemaVersion: string; pairs: DexScreenerPair[] };

            if (!data || !data.pairs || data.pairs.length === 0) {
                return null;
            }

            return data.pairs;
        } catch (error) {
            console.error(`Error searching DexScreener data:`, error);
            return null;
        }
    }

    // Add a method to determine if a token should be traded
    public async shouldTradeToken(): Promise<boolean> {
        const tokenSecurity = await this.fetchTokenSecurity();
        const tradeData = await this.fetchTokenTradeData();

        // Example logic: trade if token has recent trade activity within last 24 hours
        return tradeData.last_trade_unix_time > Date.now() - 24 * 60 * 60 * 1000;
    }

    async fetchLatestBoostedTokens(): Promise<any> {
        const url = `https://api.dexscreener.com/token-boosts/latest/v1`;
        try {
            console.log(`Fetching latest boosted tokens from DexScreener`);
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`Error fetching latest boosted tokens:`, error);
            return null;
        }
    }

    async fetchTokenOrders(chainId: string, tokenAddress: string): Promise<any> {
        const url = `https://api.dexscreener.com/orders/v1/${chainId}/${tokenAddress}`;
        try {
            console.log(`Fetching orders for token ${tokenAddress} on chain ${chainId} from DexScreener`);
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`Error fetching token orders:`, error);
            return null;
        }
    }

    async fetchPairsByTokenAddresses(tokenAddresses: string): Promise<any> {
        const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddresses}`;
        try {
            console.log(`Fetching pairs for token addresses: ${tokenAddresses} from DexScreener`);
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`Error fetching pairs by token addresses:`, error);
            return null;
        }
    }

    public async getProcessedTokenData(): Promise<ProcessedTokenData> {
        if (!this.tokenAddress) {
            throw new Error("Token address is required");
        }
      
        const cacheKey = `processedTokenData_${this.tokenAddress}`;
        const cachedData = await this.getCachedData(cacheKey);
        if (cachedData) {
          console.log(`Returning cached processed token data for ${this.tokenAddress}.`);
          return cachedData;
        }
      
        const url = `https://api.helius.xyz/v0/tokens/${this.tokenAddress}/processed`;
        const response = await this.fetchWithRetry<ProcessedTokenData>(url);
      
        if (!response) {
          throw new Error("No processed token data available");
        }
      
        await this.setCachedData(cacheKey, response);
        console.log(`Processed token data cached for ${this.tokenAddress}.`);
      
        return response;
      }

    public async getTokenAddressFromTicker(ticker: string): Promise<string | null> {
        try {
            const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${ticker}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            const data = await response.json();
            if (data && data.pairs && data.pairs.length > 0) {
                return data.pairs[0].baseToken.address;
            } else {
                return null;
            }
        } catch (error: any) {
            throw new Error(`Error fetching token address: ${error.message}`);
        }
    }
}

export class DexscreenerService {
    private readonly baseUrl = "https://api.dexscreener.com/latest/dex";

    private async fetchDexscreener(url: string, action: string) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP status ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            throw new Error(`Failed to ${action}: ${error}`);
        }
    }

    @Tool({
        name: "dexscreener.get_pairs_by_chain_and_pair",
        description: "Fetch pairs by chainId and pairId from Dexscreener",
    })
    async getPairsByChainAndPair(parameters: GetPairsByChainAndPairParameters) {
        const url = `${this.baseUrl}/pairs/${parameters.chainId}/${parameters.pairId}`;
        return this.fetchDexscreener(url, "fetch pairs");
    }

    @Tool({
        name: "dexscreener.search_pairs",
        description: "Search for DEX pairs matching a query string on Dexscreener",
    })
    async searchPairs(parameters: SearchPairsParameters) {
        const url = `${this.baseUrl}/search?q=${encodeURIComponent(parameters.query)}`;
        return this.fetchDexscreener(url, "search pairs");
    }

    @Tool({
        name: "dexscreener.get_token_pairs_by_token_address",
        description: "Get all DEX pairs for given token addresses (up to 30) from Dexscreener",
    })
    async get_token_pairs_by_token_address(parameters: GetTokenPairsParameters) {
        if (parameters.tokenAddresses.length > 30) {
            throw new Error("Maximum of 30 token addresses allowed per request");
        }
        const addresses = parameters.tokenAddresses.join(",");
        const url = `${this.baseUrl}/tokens/${addresses}`;
        return this.fetchDexscreener(url, "get token pairs");
    }
}

// Add utility functions to fetch token data by address and ticker
export async function getTokenDataByAddress(mint: PublicKey): Promise<JupiterTokenData | undefined> {
    try {
        if (!mint) {
            throw new Error("Mint address is required");
        }
        const response = await fetch(`https://tokens.jup.ag/token/${mint}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });
        const token = (await response.json()) as JupiterTokenData;
        return token;
    } catch (error: any) {
        throw new Error(`Error fetching token data: ${error.message}`);
    }
}

export async function getTokenAddressFromTicker(ticker: string): Promise<string | null> {
    try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${ticker}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        const data = await response.json();
        if (data && data.pairs && data.pairs.length > 0) {
            return data.pairs[0].baseToken.address;
        } else {
            return null;
        }
    } catch (error: any) {
        throw new Error(`Error fetching token address: ${error.message}`);
    }
}

export async function getTokenDataByTicker(
  ticker: string,
): Promise<JupiterTokenData | undefined> {
  const address = await getTokenAddressFromTicker(ticker);
  if (!address) {
    throw new Error(`Token address not found for ticker: ${ticker}`);
  }
  return getTokenDataByAddress(new PublicKey(address));
}

