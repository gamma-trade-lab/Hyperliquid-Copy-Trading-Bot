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
  export interface TokenInfo {
    mint: string;
    decimals: number;
    supply: number;
    metadata: {
      description: string;
      image: string;
    };
  }
  
  export interface MarketAnalysis {
    shouldTrade: boolean;
    confidence: number;
    action: 'BUY' | 'SELL' | 'HOLD';
    metrics?: {
      price: number;
      volume24h: number;
      marketCap: number;
    };
  }
  
  export interface TradeResult {
    success: boolean;
    signature?: string;
    error?: string;
  }
  
  export interface AgentCommand {
    type: string;
    command: string;
    raw: string;
    params?: Record<string, any>;
  }
  
  export interface CommandContext {
    platform: string;
    channelId: string;
    messageId: string;
    author: string;
  }
  
  interface SocialMetrics {
    followers: number;
    engagement: number;
    activity: string;
  }