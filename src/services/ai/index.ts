// src/services/ai/index.ts

import { TokenService, WalletService } from "../blockchain/index.js";
import { TweetGenerator } from './tweetGenerator.js';

// Re-export types
export interface MarketAnalysis {
  shouldTrade: boolean;
  confidence: number;
  action: string;
  metrics: {
    price: number;
    volume24h: number;
    marketCap: number;
    volatility?: number;
    momentum?: number;
    strength?: number;
    confidence?: number;
    onChainData?: any;
  };
}

export interface AIServiceConfig {
  groqApiKey: string;
  defaultModel?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIServiceContext {
  content: string;
  author: string;
  channel?: string;
  platform: string;
  messageId?: string;
}

export interface GenerateResponseParams {
  content: string;
  author: string;
  platform: string;
  messageId?: string;
}

export interface MarketContext {
  tokens: any[];
  timestamp: number;
  isAlert?: boolean;
}

// Export AIService class
export { AIService } from './ai';
export { TweetGenerator } from './tweetGenerator';

// Create and export default instance
import { AIService } from './ai';
import CONFIG from "../../config/settings";

export const aiService = new AIService({
  groqApiKey: CONFIG.AI.GROQ.API_KEY,
  defaultModel: CONFIG.AI.GROQ.MODEL,
  maxTokens: CONFIG.AI.GROQ.MAX_TOKENS,
  temperature: CONFIG.AI.GROQ.DEFAULT_TEMPERATURE
});

export default aiService;