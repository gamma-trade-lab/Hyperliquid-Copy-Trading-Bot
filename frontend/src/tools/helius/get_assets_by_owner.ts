import { PublicKey } from "@solana/web3.js";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

/**
 * Fetch assets by owner using the Helius Digital Asset Standard (DAS) API
 * @param ownerAddress Owner's Solana wallet PublicKey
 * @param limit Number of assets to retrieve per request
 * @returns Assets owned by the specified address
 */ 
export async function getAssetsByOwner(
agent: unknown, ownerAddress: PublicKey, limit: number = 10): Promise<any> {
  try {
    // Use the public config for client-side
    const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
    if (!heliusApiKey) {
      throw new Error('Helius API key not found');
    }

    const url = `https://api.helius.xyz/v0/addresses/${ownerAddress.toString()}/balances?api-key=${heliusApiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Helius API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform the data into the expected format
    return data.tokens?.map((token: any) => ({
      mint: token.mint,
      symbol: token.symbol,
      amount: token.amount,
      decimals: token.decimals,
      // Add additional fields as needed
    })) || [];

  } catch (error) {
    console.error('Error fetching assets:', error);
    return [];
  }
}
