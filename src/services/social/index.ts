import { TwitterService } from './twitter';
import { DiscordService } from './discord';
import { TwitterApiTokens } from 'twitter-api-v2';
import { AgentTwitterClientService } from './agentTwitterClient';
import { MarketTweetCron } from './MarketTweetCron';
import { TweetGenerator } from '../ai/tweetGenerator';
import { TradingService } from '../blockchain/trading';
import { CONFIG } from '../../config/settings';

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
    tokens: TwitterApiTokens;
    username: string;
    password: string;
    email: string;
  };
}

export class SocialService {
  private twitterService?: TwitterService;
  private agentTwitter?: AgentTwitterClientService;
  private discordService?: DiscordService;
  private marketTweetCron?: MarketTweetCron;

  constructor(config: SocialConfig) {
    if (config.twitter?.tokens) {
      // Initialize agent-twitter-client service
      if (config.twitter.username && config.twitter.password && config.twitter.email) {
        this.agentTwitter = new AgentTwitterClientService(
          config.twitter.username,
          config.twitter.password,
          config.twitter.email
        );
      }

      // Keep legacy Twitter service for now during migration
      const twitterConfig = {
        appKey: config.twitter.tokens.appKey ?? '',
        appSecret: config.twitter.tokens.appSecret ?? '',
        accessToken: config.twitter.tokens.accessToken ?? '',
        accessSecret: config.twitter.tokens.accessSecret ?? ''
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
    
    if (this.agentTwitter) {
      initPromises.push(this.agentTwitter.initialize());
      
      // Initialize market tweet cron after Twitter client is ready
      this.marketTweetCron = new MarketTweetCron(
        new TweetGenerator(),
        new TradingService(CONFIG.SOLANA.RPC_URL),
        this.agentTwitter
      );
    }
    
    if (this.twitterService) {
      initPromises.push(this.twitterService.initialize());
    }
    
    if (this.discordService) {
      // DiscordService auto-initializes in constructor
      initPromises.push(Promise.resolve());
    }
    
    await Promise.all(initPromises);
    
    // Start market tweet cron if available
    if (this.marketTweetCron) {
      this.marketTweetCron.start();
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

    if (this.agentTwitter) {
      promises.push(this.agentTwitter.sendTweet(content));
    } else if (this.twitterService) {
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
        if (this.agentTwitter) {
          const username = await this.getTweetAuthor(messageId);
          await this.agentTwitter.replyToTweet(messageId, content, username);
        } else if (this.twitterService) {
          await this.twitterService.reply(messageId, content);
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

  private async getTweetAuthor(tweetId: string): Promise<string> {
    // For now, return a default username since we don't have access to tweet data
    // This should be implemented properly in a future update
    return 'unknown_user';
  }
}

export { TwitterService } from './twitter';
export { DiscordService } from './discord';
export default SocialService;
