import { MarketData, CommunityMetrics, TweetGenerationError, TweetGenerationResult } from './types';
import { GroqAIService } from './groq';
import { CONFIG } from '../../config/settings';

interface TweetContext {
  marketData?: MarketData;
  communityMetrics?: CommunityMetrics;
  trendingTopics?: string[];
  userInteraction?: {
    username: string;
    content: string;
    platform: string;
  };
  style?: {
    tone: 'bullish' | 'bearish' | 'neutral';
    humor: number;
    formality: number;
  };
  constraints?: {
    maxLength: number;
    includeTickers: boolean;
    includeMetrics: boolean;
  };
}

export class TweetGenerator {
  private groqService: GroqAIService;
  private readonly DEFAULT_MAX_LENGTH = 280;
  private readonly DEFAULT_STYLE = {
    tone: 'neutral' as const,
    humor: 0.7,
    formality: 0.5
  };

  constructor() {
    this.groqService = new GroqAIService({
      groqApiKey: CONFIG.AI.GROQ.API_KEY,
      twitterApiKey: CONFIG.SOCIAL.TWITTER.tokens.appKey,
      twitterApiSecret: CONFIG.SOCIAL.TWITTER.tokens.appSecret,
      twitterAccessToken: CONFIG.SOCIAL.TWITTER.tokens.accessToken,
      twitterAccessSecret: CONFIG.SOCIAL.TWITTER.tokens.accessSecret
    });
  }

  async generateTweetContent(context: TweetContext): Promise<TweetGenerationResult> {
    try {
      const {
        marketData,
        communityMetrics,
        trendingTopics = [],
        style = this.DEFAULT_STYLE,
        constraints = { maxLength: this.DEFAULT_MAX_LENGTH, includeTickers: true, includeMetrics: true }
      } = context;

      if (marketData && (isNaN(marketData.price) || isNaN(marketData.volume24h))) {
        const error: TweetGenerationError = {
          name: 'TweetGenerationError',
          message: 'Invalid market data provided',
          code: 'MARKET_DATA_INVALID',
          context: marketData
        };
        throw error;
      }

      const prompt = this.buildPrompt({
        marketData,
        communityMetrics,
        trendingTopics,
        style,
        constraints
      });

      const content = await this.groqService.generateTweet({
        marketCondition: this.determineMarketCondition(marketData),
        communityMetrics,
        recentTrends: trendingTopics
      });

      if (!content || content.length > this.DEFAULT_MAX_LENGTH) {
        const error: TweetGenerationError = {
          name: 'TweetGenerationError',
          message: 'Generated content exceeds tweet length limit',
          code: 'CONTENT_GENERATION_FAILED',
          context: { content, length: content?.length }
        };
        throw error;
      }

      return {
        content,
        metadata: {
          generatedAt: new Date(),
          context: {
            marketCondition: this.determineMarketCondition(marketData),
            topics: trendingTopics,
            style
          }
        }
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Rate limit')) {
          const rateError: TweetGenerationError = {
            name: 'TweetGenerationError',
            message: 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            context: error
          };
          throw rateError;
        }
        const genError: TweetGenerationError = {
          name: 'TweetGenerationError',
          message: error.message,
          code: 'CONTENT_GENERATION_FAILED',
          context: error
        };
        throw genError;
      }
      throw error;
    }
  }

  private buildPrompt(context: TweetContext): string {
    const { marketData, style, constraints } = context;
    
    let prompt = `Generate a tweet that is:
- Engaging and authentic
- Written in a ${style?.tone || 'neutral'} tone
- Using crypto Twitter language
- Maximum ${constraints?.maxLength || this.DEFAULT_MAX_LENGTH} characters\n\n`;

    if (marketData && constraints?.includeMetrics) {
      prompt += `Market Context:
- Price: $${marketData.price}
- 24h Change: ${marketData.priceChange24h}%
- Volume: $${marketData.volume24h}
- Market Cap: $${marketData.marketCap}\n\n`;
    }

    return prompt;
  }

  private determineMarketCondition(marketData?: MarketData): string {
    if (!marketData) return 'neutral';
    
    const priceChange = marketData.priceChange24h;
    if (priceChange > 5) return 'bullish';
    if (priceChange < -5) return 'bearish';
    return 'neutral';
  }

  async generateThreadFromMarketUpdate(marketData: MarketData): Promise<string[]> {
    return this.groqService.generateThreadFromMarketData(marketData);
  }

  async generateReply(mention: { username: string; content: string }): Promise<string> {
    return this.groqService.engageWithMention(mention);
  }
}
