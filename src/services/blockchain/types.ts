import { PublicKey } from "@solana/web3.js";

export interface WalletService {
    getBalance(arg0: PublicKey): unknown;
    signTransaction(transaction: any, address: string): unknown;
    createWallet(type: string, params: any): Promise<string>;
  }
  
  export interface TokenService {
    getTokenInfo(address: PublicKey): Promise<{
      metadata?: {
        price?: string;
        marketCap?: string;
        volume24h?: string;
      };
    }>;
  }