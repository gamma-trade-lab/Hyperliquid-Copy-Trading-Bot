// src/services/social/index.ts

import { TwitterService } from './twitter';
import { DiscordService } from './discord';
import { AIService } from '../ai/types';
import { WalletService, TokenService } from '../blockchain/types';
import { TwitterApiTokens } from 'twitter-api-v2';

export interface SocialConfig {
  twitter?: {
    tokens: TwitterApiTokens;
  };
  discord?: {
    token: string;
    guildId: string;
  };
  services: {
    ai: AIService;
    wallet: WalletService;
    token: TokenService;
  };
}

export class SocialService {
  private twitterService?: TwitterService;
  private discordService?: DiscordService;

  constructor(config: SocialConfig) {
    // Initialize Twitter if configured
    if (config.twitter) {
      this.twitterService = new TwitterService({
        tokens: config.twitter.tokens,
        aiService: config.services.ai,
        walletService: config.services.wallet
      });
    }

    // Initialize Discord if configured
    if (config.discord) {
      this.discordService = new DiscordService({
        token: config.discord.token,
        guildId: config.discord.guildId,
        aiService: config.services.ai,
        walletService: config.services.wallet,
        tokenService: config.services.token
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
        initPromises.push(this.discordService.start());
      }

      await Promise.all(initPromises);
      console.log('Social services initialized successfully');
    } catch (error) {
      console.error('Error initializing social services:', error);
      throw error;
    }
  }

  async publishUpdate(content: string, platforms: ('twitter' | 'discord')[] = ['twitter', 'discord']): Promise<void> {
    try {
      const publishPromises: Promise<any>[] = [];

      if (platforms.includes('twitter') && this.twitterService) {
        publishPromises.push(this.twitterService.tweet(content));
      }

      if (platforms.includes('discord') && this.discordService) {
        // Publish to all configured Discord channels
        publishPromises.push(this.discordService.sendMessage(process.env.DISCORD_CHANNEL_ID!, content));
      }

      await Promise.all(publishPromises);
    } catch (error) {
      console.error('Error publishing update:', error);
      throw error;
    }
  }

  async publishMarketUpdate(action: string, data: Record<string, unknown>): Promise<void> {
    try {
      const updatePromises: Promise<any>[] = [];

      if (this.twitterService) {
        updatePromises.push(this.twitterService.publishMarketUpdate(action as any, data));
      }

      if (this.discordService) {
        // Format data for Discord embed
        const embed = {
          title: 'Market Update',
          description: `Action: ${action}`,
          fields: Object.entries(data).map(([key, value]) => ({
            name: key,
            value: String(value),
            inline: true
          }))
        };
        updatePromises.push(this.discordService.sendMessage(process.env.DISCORD_CHANNEL_ID!, embed));
      }

      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error publishing market update:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    const cleanupPromises: Promise<void>[] = [];

    if (this.twitterService) {
      cleanupPromises.push(this.twitterService.cleanup());
    }

    if (this.discordService) {
      cleanupPromises.push(this.discordService.cleanup());
    }

    await Promise.all(cleanupPromises);
    console.log('Social services cleaned up');
  }

  // Getters for individual services if needed
  getTwitterService(): TwitterService | undefined {
    return this.twitterService;
  }

  getDiscordService(): DiscordService | undefined {
    return this.discordService;
  }
}

// Export individual services and main service
export { TwitterService } from './twitter';
export { DiscordService } from './discord';
export default SocialService;