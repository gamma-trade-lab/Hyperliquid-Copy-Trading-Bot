import { MarketAction } from "@/config/constants";

export interface AIServiceConfig {
  useDeepSeek: boolean;
  deepSeekApiKey: string;
  defaultModel: string;
  maxTokens: number;
  temperature: number;
}

export interface LLMProvider {
  chatCompletion(request: ChatRequest): Promise<ChatResponse>;
}

export interface ChatRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  model: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  id: string;
  object: string;
  created: number;
  choices: Array<{
    message: {
      role: 'system' | 'user' | 'assistant';
      content: string;
    };
    finish_reason: string;
  }>;
}

export interface Tweet {
  id: string;
  text: string;
  author?: {
    id: string;
    username: string;
  };
}

export interface MarketAnalysis {
  shouldTrade: boolean;
  confidence: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  metrics?: MarketData;
}


import { MarketData } from '../../types/market';
export { MarketData };
  
  export interface CommunityMetrics {
    totalFollowers: number;
    activeUsers24h: number;
    sentimentScore: number;
    topInfluencers: string[];
  }

  // src/services/ai/types.ts
export interface IAIService {
  generateResponse(params: {
    content: string;
    author: string;
    channel?: string;
    platform: string;
  }): Promise<string>;
  
  generateMarketUpdate(params: {
    action: MarketAction;
    data: MarketData;
    platform: string;
  }): Promise<string>;
  
  analyzeMarket(data: MarketData): Promise<MarketAnalysis>;
  
  shouldEngageWithContent(params: {
    text: string;
    author: string;
    platform: string;
  }): Promise<boolean>;
  
  determineEngagementAction(tweet: any): Promise<{
    type: 'reply' | 'retweet' | 'like' | 'ignore';
    content?: string;
    confidence?: number;
  }>;

  generateMarketAnalysis(): Promise<string>;
}

export interface TweetGenerationError extends Error {
  code: 'CONTENT_GENERATION_FAILED' | 'MARKET_DATA_INVALID' | 'RATE_LIMIT_EXCEEDED' | 'CONTENT_LENGTH_EXCEEDED';
  context?: any;
}

export interface TweetContext {
  marketData: MarketData;
  content?: string;
  constraints?: {
    maxLength?: number;
    includeTickers?: boolean;
    includeMetrics?: boolean;
    truncateIfNeeded?: boolean;
  };
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
      truncated?: boolean;
      originalLength?: number;
    };
  };
}
