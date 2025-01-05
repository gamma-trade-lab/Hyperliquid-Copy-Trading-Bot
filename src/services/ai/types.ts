import { MarketAction } from "@/config/constants";

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

export interface TweetGenerationError extends Error {
  code: 'CONTENT_GENERATION_FAILED' | 'MARKET_DATA_INVALID' | 'RATE_LIMIT_EXCEEDED';
  context?: any;
}

export interface TweetGenerationResult {
  content: string;
  metadata: {
    generatedAt: Date;
    context: {
      marketCondition?: string;
      topics?: string[];
      style?: {
        tone: 'bullish' | 'bearish' | 'neutral';
        humor: number;
        formality: number;
      };
    };
  };
}
