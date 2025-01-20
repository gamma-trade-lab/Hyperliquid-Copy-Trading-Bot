import { PublicKey } from "@solana/web3.js";

interface JupiterTokenData {
  address: string;
  chainId: number;
  decimals: number;
  name: string;
  symbol: string;
  logoURI?: string;
  tags?: string[];
  extensions?: {
    [key: string]: any;
    coingeckoId?: string;
    twitter?: string;
    website?: string;
  };
  // Additional Jupiter-specific fields
  dirty?: boolean;
  hasFreeze?: boolean;
  mint?: string;
  pvault?: string;
}

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    symbol: string;
    address: string;
    name: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    h24: {
      buys: number;
      sells: number;
    };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  liquidity?: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv?: number;
}

export async function getTokenDataByAddress(
  mint: PublicKey,
): Promise<JupiterTokenData | undefined> {
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

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const token = (await response.json()) as JupiterTokenData;
    return token;
  } catch (error: any) {
    throw new Error(`Error fetching token data: ${error.message}`);
  }
}

export async function getTokenAddressFromTicker(
  ticker: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${ticker}`,
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: { pairs: DexScreenerPair[] } = await response.json();

    if (!data.pairs || data.pairs.length === 0) {
      return null;
    }

    // Filter for Solana pairs only and sort by FDV
    let solanaPairs = data.pairs
      .filter((pair) => pair.chainId === "solana")
      .sort((a, b) => (b.fdv || 0) - (a.fdv || 0));

    solanaPairs = solanaPairs.filter(
      (pair) => pair.baseToken.symbol.toLowerCase() === ticker.toLowerCase(),
    );

    if (solanaPairs.length === 0) {
      return null;
    }

    // Return the address of the highest FDV Solana pair
    return solanaPairs[0].baseToken.address;
  } catch (error) {
    console.error("Error fetching token address from DexScreener:", error);
    return null;
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

// Example usage:
/*
try {
  // Get token data by address
  const tokenDataByAddress = await getTokenDataByAddress(
    new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") // USDC
  );
  console.log("Token data by address:", tokenDataByAddress);

  // Get token data by ticker
  const tokenDataByTicker = await getTokenDataByTicker("BONK");
  console.log("Token data by ticker:", tokenDataByTicker);
} catch (error) {
  console.error("Error:", error);
}
*/

