import { TwitterService } from './twitter';
import { DiscordService } from './discord';
import { TweetV2PostTweetResult } from 'twitter-api-v2';

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
}

export class SocialService {
  private twitterService?: TwitterService;
  private discordService?: DiscordService;

  constructor(config: SocialConfig) {
    if (config.twitter) {
      this.twitterService = new TwitterService(
        {
          apiKey: config.twitter.apiKey,
          apiSecret: config.twitter.apiSecret,
          accessToken: config.twitter.accessToken,
          accessSecret: config.twitter.accessSecret,
          bearerToken: config.twitter.bearerToken,
          mockMode: config.twitter.mockMode,
          maxRetries: config.twitter.maxRetries,
          retryDelay: config.twitter.retryDelay,
          contentRules: config.twitter.contentRules,
          oauthClientId: config.twitter.oauthClientId,
          oauthClientSecret: config.twitter.oauthClientSecret,
          
        },
        config.services.ai
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
    const initPromises: Promise<void>[] = [];

    if (this.twitterService) {
      initPromises.push(this.twitterService.initialize());
    }

    if (this.discordService) {
      // DiscordService auto-initializes in constructor
      initPromises.push(Promise.resolve());
    }

    await Promise.all(initPromises);
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
      this.twitterService.tweet(content, { replyToTweetId: undefined })
        .then(() => promises.push(Promise.resolve()))
        .catch(error => promises.push(Promise.reject(error)));
    }

    if (this.discordService) {
      promises.push(
        this.discordService.sendMessage('System', content)
      );
    }

    await Promise.all(promises);
  }

  async sendMessage(platform: string, messageId: string, content: string): Promise<void> {
    switch (platform.toLowerCase()) {
      case 'twitter':
        if (this.twitterService) {
          await this.twitterService.tweet(content, { replyToTweetId: messageId as string | undefined });
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
  }
}

export { TwitterService } from './twitter';
export { DiscordService } from './discord';
export default SocialService;