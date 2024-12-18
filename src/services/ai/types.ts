import { MarketAction } from "@/config/constants";

export interface MarketData {
    price: number;
    volume24h: number;
    marketCap: number;
    priceChange24h: number;
    topHolders: Array<{
      address: string;
      balance: number;
    }>;
  }
  
  export interface CommunityMetrics {
    totalFollowers: number;
    activeUsers24h: number;
    sentimentScore: number;
    topInfluencers: string[];
  }

  export interface AIService {
    generateResponse(params: {
      content: string;
      author: string;
      channel: string;
      platform: string;
    }): Promise<string>;
    generateMarketAnalysis(): Promise<string>;
  }
  // src/services/ai/types.ts
export interface AIService {
  generateResponse(params: {
    content: string;
    author: string;
    channel?: string;
    platform: string;
  }): Promise<string>;
  
  generateMarketUpdate(params: {
    action: MarketAction;
    data: any;
    platform: string;
  }): Promise<string>;
  
  shouldEngageWithContent(params: {
    text: string;
    author: string;
    platform: string;
  }): Promise<boolean>;
  
  determineEngagementAction(tweet: any): Promise<{
    type: string;
    content?: string;
  }>;
}