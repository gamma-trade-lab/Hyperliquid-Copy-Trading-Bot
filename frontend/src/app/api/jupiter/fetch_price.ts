import { Tool } from "langchain/tools";
import axios from "axios";

interface TokenPrice {
  id: string;
  mintSymbol: string;
  vsToken: string;
  vsTokenSymbol: string;
  price: number;
}

interface JupiterPriceResponse {
  data: {
    [key: string]: TokenPrice;
  };
}

export class JupiterPriceTool extends Tool {
  name = "jupiter_fetch_price";
  description = `Fetch the price of a given token using Jupiter's price API.
  Inputs:
  - tokenId: string, the mint address of the token, e.g., "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"`;

  private readonly jupiterPriceUrl = "https://price.jup.ag/v4/price";
  private readonly usdcMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // Solana USDC mint

  constructor() {
    super();
  }

  async _call(input: string): Promise<string> {
    try {
      const tokenId = input.trim();
      
      // Validate input
      if (!tokenId || typeof tokenId !== 'string') {
        throw new Error('Invalid token ID provided');
      }

      // Build request URL with both token and USDC for price in USD
      const url = `${this.jupiterPriceUrl}?ids=${tokenId}&vsToken=${this.usdcMint}`;

      const response = await axios.get<JupiterPriceResponse>(url);
      
      if (!response.data?.data?.[tokenId]) {
        throw new Error(`No price data found for token: ${tokenId}`);
      }

      const priceData = response.data.data[tokenId];

      return JSON.stringify({
        status: "success",
        tokenId: tokenId,
        priceInUSDC: priceData.price,
        symbol: priceData.mintSymbol,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      if (axios.isAxiosError(error)) {
        return JSON.stringify({
          status: "error",
          message: error.response?.data?.message || error.message,
          code: error.code || "NETWORK_ERROR",
        });
      }

      const err = error as Error;
      return JSON.stringify({
        status: "error",
        message: err.message,
        code: "UNKNOWN_ERROR",
      });
    }
  }

  async fetchMultiplePrices(tokenIds: string[]): Promise<string> {
    try {
      const ids = tokenIds.map(id => id.trim()).join(',');
      
      // Validate input
      if (!ids) {
        throw new Error('Invalid token IDs provided');
      }

      // Build request URL with both tokens and USDC for price in USD
      const url = `${this.jupiterPriceUrl}?ids=${ids}&vsToken=${this.usdcMint}`;

      const response = await axios.get<JupiterPriceResponse>(url);
      
      const prices = tokenIds.map(tokenId => {
        const priceData = response.data.data[tokenId];
        if (!priceData) {
          throw new Error(`No price data found for token: ${tokenId}`);
        }
        return {
          tokenId: tokenId,
          priceInUSDC: priceData.price,
          symbol: priceData.mintSymbol,
          timestamp: new Date().toISOString()
        };
      });

      return JSON.stringify({
        status: "success",
        prices: prices
      });

    } catch (error) {
      if (axios.isAxiosError(error)) {
        return JSON.stringify({
          status: "error",
          message: error.response?.data?.message || error.message,
          code: error.code || "NETWORK_ERROR",
        });
      }

      const err = error as Error;
      return JSON.stringify({
        status: "error",
        message: err.message,
        code: "UNKNOWN_ERROR",
      });
    }
  }

  // Helper method to format price with appropriate decimals
  private formatPrice(price: number): string {
    if (price < 0.01) {
      return price.toFixed(6);
    }
    if (price < 1) {
      return price.toFixed(4);
    }
    return price.toFixed(2);
  }
}

// Usage example:
/*
const priceTool = new JupiterPriceTool();
const jupiterTokenId = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";

try {
  const priceInfo = await priceTool._call(jupiterTokenId);
  console.log(JSON.parse(priceInfo));
} catch (error) {
  console.error('Error fetching price:', error);
}
*/