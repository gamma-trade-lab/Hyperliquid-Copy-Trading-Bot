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
export interface ChatRequest {
  messages: { role: string; content: string }[];
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
    message: { role: string; content: string };
    finish_reason: string;
  }>;
}

export interface LLMProvider {
  chatCompletion(request: ChatRequest): Promise<ChatResponse>;
}

export interface AIServiceConfig {
  useDeepSeek?: boolean;
  deepSeekApiKey?: string;
  groqApiKey?: string;
  defaultModel: string;
  maxTokens: number;
  temperature: number;
}

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
