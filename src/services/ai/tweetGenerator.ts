import { MarketData, CommunityMetrics, TweetGenerationError, TweetGenerationResult } from './types.js';
import { GroqAIService } from './groq.js';
import { CONFIG } from '../../config/settings.js';

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
    truncateIfNeeded?: boolean;
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

      console.log('Generating tweet with context:', {
        marketCondition: marketData ? this.determineMarketCondition(marketData) : 'unknown',
        style,
        hasMetrics: !!marketData,
        hasCommunityData: !!communityMetrics
      });

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

      let content = await this.groqService.generateTweet({
        marketCondition: this.determineMarketCondition(marketData),
        communityMetrics,
        recentTrends: trendingTopics
      });

      if (!content) {
        const error: TweetGenerationError = {
          name: 'TweetGenerationError',
          message: 'No content generated',
          code: 'CONTENT_GENERATION_FAILED',
          context: { content }
        };
        throw error;
      }

      // Clean content - remove emojis, hashtags, and cashtags
      content = content
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Remove emojis
        .replace(/#\w+/g, '') // Remove hashtags
        .replace(/\$[A-Z]+/g, '') // Remove cashtags
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      // Handle tweet length
      const maxLength = constraints?.maxLength || this.DEFAULT_MAX_LENGTH;
      if (content.length > maxLength) {
        // Find the last complete sentence that fits
        const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
        let truncatedContent = '';
        
        for (const sentence of sentences) {
          if ((truncatedContent + sentence).length <= maxLength) {
            truncatedContent += sentence;
          } else {
            break;
          }
        }
        
        // If no complete sentence fits or content is still too long, truncate with ellipsis
        if (!truncatedContent || truncatedContent.length > maxLength) {
          content = content.substring(0, maxLength - 3).trim() + '...';
        } else {
          content = truncatedContent.trim();
        }
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
    const { marketData, style, constraints, communityMetrics } = context;
    
    let prompt = `Generate a market analysis tweet that is:
- Professional and data-focused
- Written in a clear ${style?.tone || 'neutral'} tone
- Using precise market terminology
- Maximum ${constraints?.maxLength || this.DEFAULT_MAX_LENGTH} characters
- Free of emojis and hashtags\n\n`;

    if (marketData && constraints?.includeMetrics) {
      prompt += `Market Data (use varied sentence structures, no emojis/hashtags):
Current Market Metrics:
- Asset Price: $${marketData.price.toFixed(4)} USD
- Period Change: ${marketData.priceChange24h.toFixed(2)}% over 24 hours
- Trading Volume: $${(marketData.volume24h / 1000000).toFixed(2)} million in last 24h
- Total Market Value: $${(marketData.marketCap / 1000000).toFixed(2)} million
- Holder Distribution: ${marketData.topHolders.length} unique addresses

Recent Blockchain Activity:
${marketData.onChainData ? 
`- Trading Activity: ${marketData.onChainData.recentSwaps} executed swaps
- Token Movement: ${marketData.onChainData.recentTransfers} transfer events
- Network Usage: ${marketData.onChainData.totalTransactions} total transactions` : 
'- Chain data updates pending'}

Market Intelligence:
- Overall Trend: ${this.determineMarketCondition(marketData)}
- Market Depth: ${marketData.volume24h > 1000000 ? 'Substantial liquidity' : marketData.volume24h > 100000 ? 'Average depth' : 'Developing liquidity'}
- Trading Pattern: ${marketData.onChainData?.recentSwaps !== undefined ? (marketData.onChainData.recentSwaps > 10 ? 'Active market participation' : marketData.onChainData.recentSwaps > 5 ? 'Steady trading flow' : 'Conservative trading activity') : 'No trading data'}\n\n`;
    }

    if (communityMetrics) {
      prompt += `Community Analysis (use natural language, avoid repetitive patterns):
- Community Size: ${communityMetrics.totalFollowers} total participants
- Recent Engagement: ${communityMetrics.activeUsers24h} members active in past 24 hours
- Market Confidence: ${communityMetrics.sentimentScore.toFixed(2)} confidence rating
- Vary descriptions and avoid formulaic updates
- Present metrics in context of market activity\n\n`;
    }

    prompt += `Style Guidelines:
- Keep it concise and professional (max ${constraints?.maxLength || this.DEFAULT_MAX_LENGTH} chars)
- Present market data clearly without emojis or hashtags
- Focus on price, volume, and on-chain metrics
- Include specific numerical data with proper formatting
- Maintain a clear, analytical tone
- Highlight significant market movements and trends
- Present on-chain activity data when relevant\n`;

    return prompt;
  }

  private determineMarketCondition(marketData?: MarketData): string {
    if (!marketData) return 'neutral';
    
    // Consider both price change and on-chain activity
    const priceChange = marketData.priceChange24h;
    const onChainActivity = marketData.onChainData?.recentSwaps || 0;
    
    // Strong signals
    if (priceChange > 5 && onChainActivity > 10) return 'very bullish';
    if (priceChange < -5 && onChainActivity > 10) return 'very bearish';
    
    // Moderate signals
    if (priceChange > 5) return 'bullish';
    if (priceChange < -5) return 'bearish';
    
    // Neutral with activity bias
    if (onChainActivity > 10) return 'active neutral';
    if (onChainActivity < 3) return 'quiet neutral';
    
    return 'neutral';
  }

  async generateThreadFromMarketUpdate(marketData: MarketData): Promise<string[]> {
    return this.groqService.generateThreadFromMarketData(marketData);
  }

  async generateReply(mention: { username: string; content: string }): Promise<string> {
    return this.groqService.engageWithMention(mention);
  }
}
