// src/services/social/twitter.ts

import { TwitterApi, TwitterApiTokens, TweetV2, ApiResponseError } from 'twitter-api-v2';
//import { AIService } from '../ai/groq';
import { WalletService } from '../../../srcs/services/blockchain/wallet';
import { MarketAction } from '../../config/constants';
import { AIService } from '../../../srcs/services/ai';

interface TwitterConfig {
  tokens: TwitterApiTokens;
  aiService: AIService;
  walletService: WalletService;
}

interface TweetOptions {
  replyToTweet?: string;
  mediaIds?: string[];
  quoteTweetId?: string;
}

export class TwitterService {
  private client: TwitterApi;
  private aiService: AIService;
  private walletService: WalletService;
  private rateLimits: Map<string, number> = new Map();
  private lastTweetTime: number = 0;
  private readonly MIN_TWEET_INTERVAL = 60000; // 1 minute

  constructor(config: TwitterConfig) {
    this.client = new TwitterApi(config.tokens);
    this.aiService = config.aiService;
    this.walletService = config.walletService;
  }

  async initialize(): Promise<void> {
    try {
      // Verify credentials
      const me = await this.client.v2.me();
      console.log(`Twitter bot initialized as @${me.data.username}`);

      // Start monitoring mentions and relevant keywords
      await this.startStreaming();
    } catch (error) {
      console.error('Failed to initialize Twitter service:', error);
      throw error;
    }
  }

  async tweet(content: string, options: TweetOptions = {}): Promise<string> {
    try {
      await this.checkRateLimit('tweet');
      
      // Ensure minimum interval between tweets
      const now = Date.now();
      if (now - this.lastTweetTime < this.MIN_TWEET_INTERVAL) {
        await new Promise(resolve => 
          setTimeout(resolve, this.MIN_TWEET_INTERVAL - (now - this.lastTweetTime))
        );
      }

      const mediaIds = options.mediaIds ? options.mediaIds.slice(0, 4) as [string] | [string, string] | [string, string, string] | [string, string, string, string] : undefined;

      const tweet = await this.client.v2.tweet(content, {
        reply: options.replyToTweet ? { in_reply_to_tweet_id: options.replyToTweet } : undefined,
        media: mediaIds ? { media_ids: mediaIds } : undefined,
        quote_tweet_id: options.quoteTweetId
      });

      this.lastTweetTime = Date.now();
      return tweet.data.id;
    } catch (error) {
      if (error instanceof ApiResponseError) {
        await this.handleTwitterError(error);
      }
      throw error;
    }
  }

  async reply(tweetId: string, content: string): Promise<string> {
    try {
      // Generate AI response
      const tweet = await this.client.v2.singleTweet(tweetId, {
        expansions: ['author_id'],
        'tweet.fields': ['conversation_id', 'context_annotations']
      });

      const response = await this.aiService.generateResponse({
        content: tweet.data.text,
        author: tweet.includes?.users?.[0].username,
        platform: 'twitter'
      });

      return await this.tweet(response, { replyToTweet: tweetId });
    } catch (error) {
      console.error('Error replying to tweet:', error);
      throw error;
    }
  }

  async retweet(tweetId: string): Promise<void> {
    try {
      await this.checkRateLimit('retweet');
      await this.client.v2.retweet(await this.client.v2.me().then(me => me.data.id), tweetId);
    } catch (error) {
      console.error('Error retweeting:', error);
      throw error;
    }
  }

  async like(tweetId: string): Promise<void> {
    try {
      await this.checkRateLimit('like');
      await this.client.v2.like(await this.client.v2.me().then(me => me.data.id), tweetId);
    } catch (error) {
      console.error('Error liking tweet:', error);
      throw error;
    }
  }

  async publishMarketUpdate(action: MarketAction, data: any): Promise<string> {
    try {
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

  private async startStreaming(): Promise<void> {
    try {
      const rules = await this.client.v2.streamRules();
      
      // Set up stream rules if none exist
      if (!rules.data?.length) {
        await this.client.v2.updateStreamRules({
          add: [
            { value: '@yourbotname', tag: 'mentions' },
            { value: 'your-token-symbol', tag: 'token-mentions' }
          ]
        });
      }

      const stream = await this.client.v2.searchStream({
        'tweet.fields': ['referenced_tweets', 'author_id'],
        expansions: ['referenced_tweets.id']
      });

      stream.on('data', async tweet => {
        await this.handleStreamData(tweet);
      });

      stream.on('error', error => {
        console.error('Stream error:', error);
      });
    } catch (error) {
      console.error('Error starting stream:', error);
      throw error;
    }
  }

  private async handleStreamData(tweet: TweetV2): Promise<void> {
    try {
      const shouldEngage = await this.aiService.shouldEngageWithContent({
        text: tweet.text,
        author: tweet.author_id || '',
        platform: 'twitter'
      });

      if (shouldEngage) {
        const action = await this.aiService.determineEngagementAction(tweet);
        await this.executeEngagementAction(action, tweet);
      }
    } catch (error) {
      console.error('Error handling stream data:', error);
    }
  }

  private async executeEngagementAction(
    action: { type: string; content?: string },
    tweet: TweetV2
  ): Promise<void> {
    switch (action.type) {
      case 'reply':
        if (action.content) {
          await this.reply(tweet.id, action.content);
        }
        break;
      case 'retweet':
        await this.retweet(tweet.id);
        break;
      case 'like':
        await this.like(tweet.id);
        break;
    }
  }

  private async checkRateLimit(action: string): Promise<void> {
    const limit = this.rateLimits.get(action);
    if (limit && limit <= 0) {
      throw new Error(`Rate limit exceeded for ${action}`);
    }
  }

  private async handleTwitterError(error: ApiResponseError): Promise<void> {
    if (error.rateLimit) {
      this.rateLimits.set(
        error.request.path.split('/').pop()!,
        error.rateLimit.remaining
      );
    }
    throw error;
  }

  async cleanup(): Promise<void> {
    // Implement cleanup if needed
    console.log('Twitter service cleaned up');
  }
}