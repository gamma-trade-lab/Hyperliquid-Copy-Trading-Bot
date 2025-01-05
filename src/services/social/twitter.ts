// src/services/social/twitter.ts

import { Scraper, Tweet, TweetResponse } from 'agent-twitter-client';
import { AIService } from '../ai/types';
import { MarketAction } from '../../config/constants';

interface TwitterConfig {
  credentials: {
    username: string;
    password: string;
    email: string;
  };
  aiService: AIService;
}

interface TweetOptions {
  replyToTweet?: string;
  quoteTweetId?: string;
}

export class TwitterService {
  private scraper: Scraper;
  private aiService: AIService;
  private isInitialized: boolean = false;
  private credentials?: TwitterConfig['credentials'];

  constructor(config: TwitterConfig) {
    this.scraper = new Scraper();
    this.aiService = config.aiService;
    this.credentials = config.credentials;
  }

  async initialize(): Promise<void> {
    try {
      if (!this.isInitialized && this.credentials) {
        await this.scraper.login(
          this.credentials.username,
          this.credentials.password,
          this.credentials.email
        );
        console.log(`Twitter bot initialized as @${this.credentials.username}`);
        this.isInitialized = true;
      }
    } catch (error) {
      console.error('Failed to initialize Twitter service:', error);
      throw error;
    }
  }

  async tweet(content: string, options: TweetOptions = {}): Promise<string> {
    try {
      if (!this.isInitialized) {
        throw new Error('Twitter service not initialized');
      }

      if (options.replyToTweet) {
        const response = await this.scraper.sendTweet(content, options.replyToTweet) as TweetResponse;
        return response.tweet_id;
      } else if (options.quoteTweetId) {
        const response = await this.scraper.sendQuoteTweet(content, options.quoteTweetId) as TweetResponse;
        return response.tweet_id;
      } else {
        const response = await this.scraper.sendTweet(content) as TweetResponse;
        return response.tweet_id;
      }
    } catch (error) {
      console.error('Error sending tweet:', error);
      throw error;
    }
  }

  async reply(tweetId: string, content: string): Promise<string> {
    try {
      if (!this.isInitialized) {
        throw new Error('Twitter service not initialized');
      }

      const tweet = await this.scraper.getTweet(tweetId) as Tweet;
      const response = await this.aiService.generateResponse({
        content: tweet.text || '',
        author: tweet.user?.screen_name || 'unknown',
        platform: 'twitter',
        channel: tweet.id_str || tweetId
      });

      const result = await this.scraper.sendTweet(response, tweetId) as TweetResponse;
      return result.tweet_id;
    } catch (error) {
      console.error('Error replying to tweet:', error);
      throw error;
    }
  }

  async retweet(tweetId: string): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('Twitter service not initialized');
      }

      await this.scraper.retweet(tweetId);
    } catch (error) {
      console.error('Error retweeting:', error);
      throw error;
    }
  }

  async like(tweetId: string): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('Twitter service not initialized');
      }

      await this.scraper.likeTweet(tweetId);
    } catch (error) {
      console.error('Error liking tweet:', error);
      throw error;
    }
  }

  async publishMarketUpdate(action: MarketAction, data: Record<string, unknown>): Promise<string> {
    try {
      if (!this.isInitialized) {
        throw new Error('Twitter service not initialized');
      }

      const content = await this.aiService.generateMarketUpdate({
        action,
        data,
        platform: 'twitter'
      });

      return await this.tweet(content);
    } catch (error) {
      console.error('Error publishing market update:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.isInitialized) {
        await this.scraper.logout();
        this.isInitialized = false;
      }
      console.log('Twitter service cleaned up');
    } catch (error) {
      console.error('Error during cleanup:', error);
      throw error;
    }
  }
}
