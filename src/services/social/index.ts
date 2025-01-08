import { TwitterService } from './twitter';
import { DiscordService } from './discord';
import { TwitterApiTokens } from 'twitter-api-v2';

export interface SocialMetrics {
  followers: number;
  engagement: number;
  activity: string;
}

export interface SocialConfig {
  services: {
    ai: any; // Let the concrete implementations handle AI type checking
  };
  discord: {
    token: string;
    guildId: string;
  };
  twitter: {
    tokens: TwitterApiTokens & { bearerToken: string; username: string }; // Ensure bearerToken and username are included
  };
}

export class SocialService {
  private twitterService?: TwitterService;
  private discordService?: DiscordService;

  constructor(config: SocialConfig) {
    if (config.twitter?.tokens) {
      const twitterConfig = {
        username: config.twitter.tokens.username ?? '',
        password: process.env.TWITTER_PASSWORD ?? '',
        email: process.env.TWITTER_EMAIL ?? '',
        mockMode: process.env.TWITTER_MOCK_MODE === 'true',
        maxRetries: Number(process.env.TWITTER_MAX_RETRIES) || 3,
        retryDelay: Number(process.env.TWITTER_RETRY_DELAY) || 5000,
        contentRules: {
          maxEmojis: Number(process.env.TWITTER_MAX_EMOJIS) || 0,
          maxHashtags: Number(process.env.TWITTER_MAX_HASHTAGS) || 0,
          minInterval: Number(process.env.TWITTER_MIN_INTERVAL) || 300000
        }
      };
      
      this.twitterService = new TwitterService(twitterConfig, config.services.ai);
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
      promises.push(this.twitterService.tweet(content).then(() => {}));
    }
    
    if (this.discordService) {
      promises.push(this.discordService.sendMessage('System', content).then(() => {}));
    }
    
    await Promise.all(promises);
  }

  async sendMessage(platform: string, messageId: string, content: string): Promise<void> {
    switch (platform.toLowerCase()) {
      case 'twitter':
        if (this.twitterService) {
          await this.twitterService.reply(messageId, content); // Ensure TwitterService has a reply method
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
