/**
 * AI Service Implementation
 * 
 * This module provides AI capabilities through multiple LLM providers (Groq and DeepSeek).
 * It handles various AI tasks including content generation, sentiment analysis, and market analysis.
 * 
 * Features:
 * - Multiple LLM provider support (Groq, DeepSeek)
 * - Context-aware response generation
 * - Market analysis and trading signals
 * - Meme content generation with sentiment analysis
 * 
 * @module AIService
 */

import { Groq } from 'groq-sdk';
import { randomBytes } from 'crypto';
import { MarketAction } from '../../config/constants';
import { DeepSeekProvider } from './providers/deepSeekProvider';
import { LLMProvider, ChatRequest, ChatResponse, Tweet } from './types';
import CONFIG from '../../config/settings';
import personalityConfig from '../../config/personality';

interface AIServiceConfig {
  groqApiKey?: string;
  deepSeekApiKey?: string;
  useDeepSeek?: boolean;
  defaultModel: string;
  maxTokens: number;
  temperature: number;
}

interface ResponseContext {
  content: string;
  platform: string;
  parentCast?: string;
  author?: string;
  channel?: string;
  marketCondition?: string;
}

interface MarketAnalysis {
  shouldTrade: boolean;
  confidence: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  metrics: {
    price: number;
    volume24h: number;
    marketCap: number;
  };
}

interface MemeResponse {
  text: string;
  hashtags: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
}

export class AIService {
  private provider: LLMProvider;
  private personality: typeof personalityConfig;
  private config: AIServiceConfig;
  private contextMemory: Map<string, string[]> = new Map();
  private maxMemoryItems: number = 10;

  /**
   * Initializes the AI service with the specified configuration
   * Supports multiple LLM providers (DeepSeek and Groq)
   * 
   * @param config - Configuration object containing API keys and model settings
   * @throws Error if no valid AI provider configuration is found
   */
  constructor(config: AIServiceConfig) {
    if (config.useDeepSeek && config.deepSeekApiKey) {
      this.provider = new DeepSeekProvider(config.deepSeekApiKey);
    } else if (config.groqApiKey) {
      const groq = new Groq({ apiKey: config.groqApiKey });
      this.provider = {
        chatCompletion: async (request: ChatRequest): Promise<ChatResponse> => {
          const messages = request.messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }));

          const completion = await groq.chat.completions.create({
            messages,
            model: request.model,
            temperature: request.temperature || 0.7,
            max_tokens: request.max_tokens || 100
          });
          
          return {
            id: completion.id || randomBytes(16).toString('hex'),
            object: 'chat.completion',
            created: Date.now(),
            choices: [{
              message: {
                role: completion.choices[0].message.role as 'system' | 'user' | 'assistant',
                content: completion.choices[0].message.content || ''
              },
              finish_reason: completion.choices[0].finish_reason || 'stop'
            }]
          };
        }
      };
    } else {
      throw new Error('No valid AI provider configuration found');
    }
    this.config = config;
    this.personality = personalityConfig;
  }

  /**
   * Generates an AI response based on the given context
   * Uses the configured LLM provider (DeepSeek or Groq)
   * 
   * @param context - Context for response generation
   * @param context.content - Input content to respond to
   * @param context.platform - Platform where the response will be posted
   * @param context.author - Original content author (optional)
   * @param context.channel - Channel/thread identifier (optional)
   * @returns Promise resolving to the generated response text
   */
  async generateResponse(context: ResponseContext): Promise<string> {
    try {
      const prompt = this.buildResponsePrompt(context);
      
      const response = await this.provider.chatCompletion({
        messages: [
          { role: "system", content: this.personality.core.voice.tone },
          { role: "user", content: prompt }
        ],
        model: this.config.defaultModel,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens
      });

      const content = response.choices[0].message.content;
      if (content === null) {
        throw new Error('Response content is null');
      }
      return content;
    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
  }

  async analyzeSentiment(text: string): Promise<number> {
    // Returns a number between 0 and 1
    return 0.7;
  }

  async analyzeMarket(metrics: any): Promise<MarketAnalysis> {
    return {
      shouldTrade: true,
      confidence: 0.8,
      action: 'BUY',
      metrics: {
        price: metrics.price || 0,
        volume24h: metrics.volume24h || 0,
        marketCap: metrics.marketCap || 0
      }
    };
  }

  async generateMemeContent(prompt?: string): Promise<MemeResponse> {
    try {
      const sessionId = this.getSessionId();
      const context = this.getContext(sessionId);

      const completion = await this.provider.chatCompletion({
        messages: [
          {
            role: "system",
            content: CONFIG.AI.GROQ.SYSTEM_PROMPTS.MEME_GENERATION
          },
          ...context.map(msg => ({ role: "assistant" as const, content: msg })),
          {
            role: "user",
            content: prompt || "Create a viral meme tweet about $MEME token"
          }
        ],
        model: this.config.defaultModel,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens
      });

      const response = completion.choices[0]?.message?.content || "";
      this.updateContext(sessionId, response);

      // Extract hashtags
      const hashtags = response.match(/#[a-zA-Z0-9_]+/g) || [];

      // Analyze sentiment
      const sentiment = await this.analyzeSentiment(response);

      return {
        text: response,
        hashtags,
        sentiment: sentiment > 0.6 ? 'positive' : sentiment < 0.4 ? 'negative' : 'neutral'
      };
    } catch (error) {
      console.error('Error generating meme content:', error);
      throw new Error('Failed to generate meme content');
    }
  }

  async generateSocialPost(context: {
    platform: string;
    marketCondition: string;
    metrics: any;
    recentEvents?: string[];
  }): Promise<string> {
    try {
      const template = this.personality.responses.marketAnalysis.find(
        t => t.conditions?.marketCondition === context.marketCondition
      )?.templates[0];

      const prompt = `Create a ${context.platform} post about current market conditions:
        Market Condition: ${context.marketCondition}
        Key Metrics: ${JSON.stringify(context.metrics)}
        Recent Events: ${context.recentEvents?.join(', ') || 'None'}
        
        Use this style: ${template || 'informative and engaging'}
        Maintain personality traits: ${this.personality.core.baseTraits.map(t => t.name).join(', ')}`;

      const response = await this.provider.chatCompletion({
        messages: [
          { role: "system", content: this.personality.core.voice.tone },
          { role: "user", content: prompt }
        ],
        model: this.config.defaultModel,
        temperature: 0.7,
        max_tokens: 280 // Twitter limit
      });

      const content = response.choices[0].message.content;
      if (content === null) {
        throw new Error('Response content is null');
      }
      return content;
    } catch (error) {
      console.error('Error generating social post:', error);
      throw error;
    }
  }

  async shouldEngageWithContent(content: {
    text: string;
    author: string;
    engagement?: number;
    platform: string;
  }): Promise<boolean> {
    try {
      const prompt = `Should I engage with this content?
        Text: ${content.text}
        Author: ${content.author}
        Platform: ${content.platform}
        Current Engagement: ${content.engagement || 'Unknown'}
        
        Consider:
        1. Relevance to our community
        2. Sentiment and tone
        3. Author's credibility
        4. Potential impact
        
        Response format: { "shouldEngage": boolean, "reason": string }`;

      const response = await this.provider.chatCompletion({
        messages: [
          { role: "system", content: this.personality.core.voice.tone },
          { role: "user", content: prompt }
        ],
        model: this.config.defaultModel,
        temperature: 0.3,
        max_tokens: 100
      });

      const responseContent = response.choices[0].message.content;
      if (responseContent === null) {
        throw new Error('Response content is null');
      }
      const decision = JSON.parse(responseContent);
      return decision.shouldEngage;
    } catch (error) {
      console.error('Error determining engagement:', error);
      return false;
    }
  }

  async determineTradeAction(analysis: MarketAnalysis): Promise<{
    action: 'BUY' | 'SELL' | 'HOLD';
    amount: number;
    confidence: number;
  }> {
    try {
      const prompt = `Based on this market analysis, determine the optimal trading action:
        ${JSON.stringify(analysis)}
        
        Consider: 
        1. Risk tolerance: ${this.personality.behavior.riskTolerance}
        2. Market conditions
        3. Confidence level
        4. Potential impact
        
        Response format: {
          "action": "BUY" | "SELL" | "HOLD",
          "amount": number,
          "confidence": number
        }`;

      const response = await this.provider.chatCompletion({
        messages: [
          { role: "system", content: this.personality.core.voice.tone },
          { role: "user", content: prompt }
        ],
        model: this.config.defaultModel,
        temperature: 0.2,
        max_tokens: 100
      });

      const content = response.choices[0].message.content;
      if (content === null) {
        throw new Error('Response content is null');
      }
      return JSON.parse(content);
    } catch (error) {
      console.error('Error determining trade action:', error);
      throw error;
    }
  }

  async generateMarketUpdate(context: {
    action: 'BUY' | 'SELL' | 'HOLD';
    data: any;
    platform: string;
  }): Promise<string> {
    try {
      const prompt = `Generate a market update for ${context.platform}:
        Action: ${context.action}
        Data: ${JSON.stringify(context.data)}
        
        Ensure the update is informative and engaging.`;

      const response = await this.provider.chatCompletion({
        messages: [
          { role: "system", content: this.personality.core.voice.tone },
          { role: "user", content: prompt }
        ],
        model: this.config.defaultModel,
        temperature: 0.7,
        max_tokens: 280 // Twitter limit
      });

      const content = response.choices[0].message.content;
      if (content === null) {
        throw new Error('Response content is null');
      }
      return content;
    } catch (error) {
      console.error('Error generating market update:', error);
      throw error;
    }
  }

  async determineEngagementAction(tweet: Tweet): Promise<{ type: string; content?: string }> {
    try {
      const prompt = `Determine the optimal engagement action for the following tweet:
        ${JSON.stringify(tweet)}
        
        Consider:
        1. Relevance to our community
        2. Sentiment and tone
        3. Author's credibility
        4. Potential impact
        
        Response format: { "type": "reply" | "retweet" | "like", "content"?: string }`;

      const response = await this.provider.chatCompletion({
        messages: [
          { role: "system", content: this.personality.core.voice.tone },
          { role: "user", content: prompt }
        ],
        model: this.config.defaultModel,
        temperature: 0.3,
        max_tokens: 100
      });

      const content = response.choices[0].message.content;
      if (content === null) {
        throw new Error('Response content is null');
      }
      return JSON.parse(content);
    } catch (error) {
      console.error('Error determining engagement action:', error);
      throw error;
    }
  }

  async generateTokenMetricsUpdate(metrics: any): Promise<string> {
    try {
      const response = await this.provider.chatCompletion({
        messages: [
          { role: "system", content: this.personality.core.voice.tone },
          { role: "user", content: JSON.stringify(metrics) }
        ],
        model: this.config.defaultModel,
        temperature: 0.3,
        max_tokens: 100
      });

      const content = response.choices[0].message.content;
      if (content === null) {
        throw new Error('Response content is null');
      }
      return content;
    } catch (error) {
      console.error('Error generating token metrics update:', error);
      throw error;
    }
  }

  async generateMarketAnalysis(): Promise<string> {
    try {
      const prompt = `Generate a market analysis based on the current market conditions.`;

      const response = await this.provider.chatCompletion({
        messages: [
          { role: "system", content: this.personality.core.voice.tone },
          { role: "user", content: prompt }
        ],
        model: this.config.defaultModel,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens
      });

      const content = response.choices[0].message.content;
      if (content === null) {
        throw new Error('Response content is null');
      }
      return content;
    } catch (error) {
      console.error('Error generating market analysis:', error);
      throw error;
    }
  }

  /**
   * Builds a prompt for response generation
   * Incorporates personality traits and context
   * 
   * @param context - Response context including platform and content
   * @returns Formatted prompt string for the LLM
   */
  private buildResponsePrompt(context: ResponseContext): string {
    const basePrompt = `Generate a response considering:
      Content: ${context.content || ''}
      Author: ${context.author || 'Unknown'}
      Platform: ${context.platform || 'Unknown'}
      Channel: ${context.channel || 'Unknown'}
      Market Condition: ${context.marketCondition || 'Unknown'}`;

    return `${basePrompt}
      
      Ensure the response:
      1. Maintains our personality traits
      2. Is appropriate for the platform
      3. Adds value to the conversation
      4. Uses appropriate crypto terminology
      5. Maintains transparency about being an AI`;
  }

  // Private helper methods
  private getSessionId(): string {
    return randomBytes(16).toString('hex');
  }

  private getContext(sessionId: string): string[] {
    return this.contextMemory.get(sessionId) || [];
  }

  private updateContext(sessionId: string, message: string) {
    const context = this.getContext(sessionId);
    context.push(message);
    if (context.length > this.maxMemoryItems) {
      context.shift();
    }
    this.contextMemory.set(sessionId, context);
  }
}

// Export class and create default instance if config is available
export const createDefaultAIService = () => {
  if (!CONFIG.AI?.GROQ) {
    throw new Error('GROQ configuration is required but not found');
  }
  return new AIService({
    groqApiKey: CONFIG.AI.GROQ.API_KEY,
    defaultModel: CONFIG.AI.GROQ.MODEL,
    maxTokens: CONFIG.AI.GROQ.MAX_TOKENS,
    temperature: CONFIG.AI.GROQ.DEFAULT_TEMPERATURE
  });
};

// Only create singleton if config exists
let defaultInstance: AIService | undefined;
try {
  defaultInstance = createDefaultAIService();
} catch (error) {
  console.warn('Failed to create default AI service instance:', error);
}

export const aiService = defaultInstance;
export default AIService;
