// src/services/social/twitter.ts

import { TwitterApi, TwitterApiTokens, TweetV2, ApiResponseError } from 'twitter-api-v2';
import { AIService } from '../ai/types';
import { WalletService } from '../blockchain/types';
import { MarketAction } from '../../config/constants';

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
  private rateLimits: Map<string, number>;
  private lastTweetTime: number;
  private readonly MIN_TWEET_INTERVAL = 60000; // 1 minute

  constructor(config: TwitterConfig) {
    this.client = new TwitterApi(config.tokens);
    this.aiService = config.aiService;
    this.walletService = config.walletService;
    this.rateLimits = new Map();
    this.lastTweetTime = 0;
  }

  async initialize(): Promise<void> {
    try {
      const me = await this.client.v2.me();
      console.log(`Twitter bot initialized as @${me.data.username}`);
      await this.startStreaming();
    } catch (error) {
      console.error('Failed to initialize Twitter service:', error);
      throw error;
    }
  }

  async tweet(content: string, options: TweetOptions = {}): Promise<string> {
    try {
      await this.checkRateLimit('tweet');
      
      const now = Date.now();
      const timeToWait = this.MIN_TWEET_INTERVAL - (now - this.lastTweetTime);
      if (timeToWait > 0) {
        await new Promise(resolve => setTimeout(resolve, timeToWait));
      }

      let mediaIds: [string] | [string, string] | [string, string, string] | [string, string, string, string] | undefined = undefined;
      if (options.mediaIds && options.mediaIds.length > 0) {
        mediaIds = options.mediaIds.slice(0, 4) as [string] | [string, string] | [string, string, string] | [string, string, string, string];
      }

      const tweetData = {
        text: content,
        ...(options.replyToTweet && {
          reply: { in_reply_to_tweet_id: options.replyToTweet }
        }),
        ...(mediaIds && { media: { media_ids: mediaIds } }),
        ...(options.quoteTweetId && { quote_tweet_id: options.quoteTweetId })
      };

      const tweet = await this.client.v2.tweet(tweetData);
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
      const tweet = await this.client.v2.singleTweet(tweetId, {
        expansions: ['author_id'],
        'tweet.fields': ['conversation_id', 'context_annotations']
      });

      const author = tweet.includes?.users?.[0]?.username || 'unknown_user';
      
      const response = await this.aiService.generateResponse({
        content: tweet.data.text,
        author: author,
        platform: 'twitter',
        channel: tweet.data.conversation_id || undefined
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
      const me = await this.client.v2.me();
      await this.client.v2.retweet(me.data.id, tweetId);
    } catch (error) {
      console.error('Error retweeting:', error);
      throw error;
    }
  }

  async like(tweetId: string): Promise<void> {
    try {
      await this.checkRateLimit('like');
      const me = await this.client.v2.me();
      await this.client.v2.like(me.data.id, tweetId);
    } catch (error) {
      console.error('Error liking tweet:', error);
      throw error;
    }
  }

  async publishMarketUpdate(action: MarketAction, data: Record<string, unknown>): Promise<string> {
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
      
      if (!rules.data || rules.data.length === 0) {
        const me = await this.client.v2.me();
        await this.client.v2.updateStreamRules({
          add: [
            { value: `@${me.data.username}`, tag: 'mentions' },
            { value: 'your-token-symbol', tag: 'token-mentions' }
          ]
        });
      }

      const stream = await this.client.v2.searchStream({
        'tweet.fields': ['referenced_tweets', 'author_id'],
        expansions: ['referenced_tweets.id']
      });

      stream.on('data', async (tweet: TweetV2) => {
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
      if (!tweet.author_id) return;

      const shouldEngage = await this.aiService.shouldEngageWithContent({
        text: tweet.text,
        author: tweet.author_id,
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
    try {
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
        default:
          console.log(`Unknown action type: ${action.type}`);
      }
    } catch (error) {
      console.error('Error executing engagement action:', error);
    }
  }

  private async checkRateLimit(action: string): Promise<void> {
    const limit = this.rateLimits.get(action);
    if (typeof limit === 'number' && limit <= 0) {
      throw new Error(`Rate limit exceeded for ${action}`);
    }
  }

  private async handleTwitterError(error: ApiResponseError): Promise<void> {
    if (error.rateLimit) {
      const path = error.request.path.split('/').pop();
      if (path) {
        this.rateLimits.set(path, error.rateLimit.remaining);
      }
    }
    throw error;
  }

  async cleanup(): Promise<void> {
    console.log('Twitter service cleaned up');
  }
}