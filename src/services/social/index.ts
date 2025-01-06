import { TwitterService, TwitterConfig } from './twitter';
import { DiscordService } from './discord';
import { TwitterApiTokens } from 'twitter-api-v2';
import { AgentTwitterClientService } from './agentTwitterClient.js';
import { AIService as AIServiceImpl } from '../ai/ai';
import { IAIService } from '../ai/types';
import { MarketData } from '../../types/market';

export interface SocialMetrics {
  followers: number;
  engagement: number;
  activity: string;
}

export interface SocialConfig {
  services: {
    ai: AIServiceImpl;  // Using concrete implementation
  };
  discord?: {
    token?: string;
    guildId?: string;
  };
  twitter?: {
    tokens?: TwitterApiTokens;
    credentials?: {
      username: string;
      password: string;
      email: string;
    };
  };
  twitterClient?: AgentTwitterClientService;
}

export class SocialService {
  private twitterService?: TwitterService;
  private agentTwitter?: AgentTwitterClientService;
  private discordService?: DiscordService;

  constructor(config: SocialConfig) {
    // Initialize Twitter client if provided
    if (config.twitterClient) {
      this.agentTwitter = config.twitterClient;
    } else if (config.twitter?.tokens && config.twitter.credentials) {
      // Initialize agent-twitter-client service
      this.agentTwitter = new AgentTwitterClientService(
        config.twitter.credentials.username,
        config.twitter.credentials.password,
        config.twitter.credentials.email,
        config.services.ai
      );

      // Keep legacy Twitter service for now during migration
      const twitterConfig: TwitterConfig = {
        credentials: config.twitter.credentials,
        aiService: config.services.ai as AIServiceImpl // Cast to implementation type
      };
      
      this.twitterService = new TwitterService(twitterConfig);
    }

    // Discord service initialization is optional
    if (config.discord?.token && config.discord?.guildId) {
      try {
        this.discordService = new DiscordService({
          token: config.discord.token,
          guildId: config.discord.guildId,
          aiService: config.services.ai as AIServiceImpl // Cast to implementation type
        });
      } catch (error) {
        console.warn('Failed to initialize Discord service:', error);
        // Continue without Discord
      }
    }
  }

  async initialize(): Promise<void> {
    const initPromises: Promise<void>[] = [];
    
    if (this.agentTwitter) {
      initPromises.push(this.agentTwitter.initialize());
    }
    
    if (this.twitterService) {
      initPromises.push(this.twitterService.initialize());
    }
    
    if (this.discordService) {
      // DiscordService auto-initializes in constructor
      initPromises.push(Promise.resolve());
    }
    
    await Promise.all(initPromises);
  }

  async getTwitterClient(): Promise<AgentTwitterClientService | undefined> {
    return this.agentTwitter;
  }

  async getCommunityMetrics(): Promise<SocialMetrics> {
    return {
      followers: 1000,
      engagement: 0.75,
      activity: 'High'
    };
  }

  async postTweet(content: string): Promise<{ success: boolean; error?: Error }> {
    if (!content) {
      return { success: false, error: new Error('Tweet content cannot be empty') };
    }

    if (content.length > 280) {
      return { success: false, error: new Error('Tweet content exceeds maximum length of 280 characters') };
    }

    try {
      if (this.agentTwitter) {
        const result = await this.agentTwitter.sendTweet(content);
        console.log('Successfully posted tweet using AgentTwitterClient');
        return result;
      } else if (this.twitterService) {
        const result = await this.twitterService.tweet(content);
        console.log('Successfully posted tweet using legacy TwitterClient');
        return { success: result.success, error: result.error };
      } else {
        return { success: false, error: new Error('No Twitter client available') };
      }
    } catch (error) {
      console.error('Error posting tweet:', error);
      return { success: false, error: error as Error };
    }
  }

  async send(content: string): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.agentTwitter) {
      promises.push(this.agentTwitter.sendTweet(content).then(() => {
        console.log('Tweet sent successfully via AgentTwitterClient');
      }));
    } else if (this.twitterService) {
      promises.push(this.twitterService.tweet(content).then(() => {
        console.log('Tweet sent successfully via legacy Twitter service');
      }));
    }
    
    if (this.discordService) {
      promises.push(this.discordService.sendMessage('System', content).then(() => {
        console.log('Message sent successfully to Discord');
      }));
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
export { AgentTwitterClientService } from './agentTwitterClient.js';
export * from './twitter.types';
export * from './agentTwitterClient.types';
export default SocialService;
