import { TwitterService } from './twitter';
import { DiscordService } from './discord';
import { TweetV2PostTweetResult } from 'twitter-api-v2';
import { MarketDataProcessor } from '../market/data/DataProcessor';
import { HeliusService } from '../blockchain/heliusIntegration';
import { JupiterPriceV2Service } from '../blockchain/defi/JupiterPriceV2Service';
import { JupiterPriceV2 } from '../blockchain/defi/jupiterPriceV2';
import Redis from 'ioredis';
import { elizaLogger } from "@ai16z/eliza";
import { TokenPrice } from '../blockchain/defi/JupiterPriceV2Service';

export interface SocialMetrics {
  followers: number;
  engagement: number;
  activity: string;
}

export interface SocialConfig {
  services: {
    ai: any; // Let the concrete implementations handle AI type checking
  };
  discord?: {
    token: string;
    guildId: string;
  };
  twitter?: {
    oauthClientId: string;
    oauthClientSecret: string;
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessSecret: string;
    bearerToken: string;
    mockMode?: boolean;
    maxRetries?: number;
    retryDelay?: number;
    contentRules?: {
      maxEmojis: number;
      maxHashtags: number;
      minInterval: number;
    };
  };
  helius?: {
    apiKey: string;
  };
  redis?: {
    host?: string;
    port?: number;
    password?: string;
  };
}

export class SocialService {
  private twitterService?: TwitterService;
  private discordService?: DiscordService;
  private readonly dataProcessor: MarketDataProcessor;
  private readonly jupiterService: JupiterPriceV2Service;

  constructor(config: SocialConfig) {
    if (!config.helius?.apiKey) {
      throw new Error('Helius API key is required');
    }

    // Initialize services with proper configuration
    this.jupiterService = new JupiterPriceV2Service({
      redis: {
        host: config.redis?.host || process.env.REDIS_HOST,
        port: config.redis?.port || parseInt(process.env.REDIS_PORT || '6379'),
        password: config.redis?.password || process.env.REDIS_PASSWORD,
        keyPrefix: 'jupiter-price:',
        enableCircuitBreaker: true
      }
    });
    

    // Create price fetcher function with proper type

    // Initialize data processor with price fetcher
    this.dataProcessor = new MarketDataProcessor(
      config.helius.apiKey,
      'https://tokens.jup.ag/tokens?tags=verified'
    );

    if (config.twitter) {
      this.twitterService = new TwitterService(
        {
          apiKey: config.twitter.apiKey,
          apiSecret: config.twitter.apiSecret,
          accessToken: config.twitter.accessToken,
          accessSecret: config.twitter.accessSecret,
          bearerToken: config.twitter.bearerToken,
          mockMode: config.twitter.mockMode ?? false,
          maxRetries: config.twitter.maxRetries ?? 0,
          retryDelay: config.twitter.retryDelay ?? 0,
          contentRules: config.twitter.contentRules || { maxEmojis: 0, maxHashtags: 0, minInterval: 0 },
          oauthClientId: config.twitter.oauthClientId,
          oauthClientSecret: config.twitter.oauthClientSecret,
          marketDataConfig: {
            heliusApiKey: config.helius.apiKey,
            updateInterval: 0,
            volatilityThreshold: 0
          },
          tokenAddresses: []
        },
        config.services.ai,
        this.dataProcessor
      );
    }

    if (config.discord) {
      this.discordService = new DiscordService({
        token: config.discord.token,
        guildId: config.discord.guildId,
        aiService: config.services.ai
      });
    }
  }

  async initialize(): Promise<void> {
    try {
      const initPromises: Promise<void>[] = [];

      if (this.twitterService) {
        initPromises.push(this.twitterService.initialize());
      }

      if (this.discordService) {
        // DiscordService auto-initializes in constructor
        initPromises.push(Promise.resolve());
      }

      await Promise.all(initPromises);
      elizaLogger.success('Social services initialized successfully');
    } catch (error) {
      elizaLogger.error('Failed to initialize social services:', error);
      throw error;
    }
  }

  async getCommunityMetrics(): Promise<SocialMetrics> {
    return {
      followers: 1000,
      engagement: 0.75,
      activity: 'High'
    };
  }

  async send(content: string): Promise<void> {
    const promises: Promise<void>[] = [];
 
    if (this.twitterService) {
      try {
        await this.twitterService.tweet(content, { replyToTweetId: undefined });
        promises.push(Promise.resolve());
      } catch (error) {
        elizaLogger.error('Failed to send tweet:', error);
        promises.push(Promise.reject(error));
      }
    }

    if (this.discordService) {
      promises.push(
        this.discordService.sendMessage('System', content)
      );
    }

    await Promise.all(promises);
  }

  async sendMessage(platform: string, messageId: string, content: string): Promise<void> {
    try {
      switch (platform.toLowerCase()) {
        case 'twitter':
          if (this.twitterService) {
            await this.twitterService.tweet(content, { replyToTweetId: messageId });
          }
          break;
        case 'discord':
          if (this.discordService) {
            await this.discordService.sendMessage(messageId, content);
          }
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      elizaLogger.error(`Failed to send message to ${platform}:`, error);
      throw error;
    }
  }
}

export { TwitterService } from './twitter';
export { DiscordService } from './discord';
export default SocialService;