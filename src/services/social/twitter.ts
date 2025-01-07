import { TwitterApi, ApiResponseError, TweetV2PostTweetResult, SendTweetV2Params } from 'twitter-api-v2';
import { AIService } from '../ai';
import { elizaLogger } from "@ai16z/eliza";

interface TwitterConfig {
  username: string;
  password: string;
  email: string;
  mockMode?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  contentRules?: {
    maxEmojis: number;
    maxHashtags: number;
    minInterval: number;
  };
}

interface TwitterServiceConfig {
  maxRetries: number;
  retryDelay: number;
  mockMode: boolean;
  contentRules: {
    maxEmojis: number;
    maxHashtags: number;
    minInterval: number;
  };
}

export class TwitterService {
  private client: TwitterApi;
  private appOnlyClient: TwitterApi;
  private aiService: AIService;
  private username: string;
  private isStreaming: boolean = false;
  private config: TwitterServiceConfig;

  constructor(config: TwitterConfig, aiService: AIService) {
    // Initialize with direct authentication
    this.client = new TwitterApi();
    this.appOnlyClient = this.client; // Same client for both in direct auth
    
    this.aiService = aiService;
    this.username = config.username;
    
    // Set configuration defaults
    this.config = {
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 5000,
      mockMode: config.mockMode || false,
      contentRules: {
        maxEmojis: config.contentRules?.maxEmojis || 0,
        maxHashtags: config.contentRules?.maxHashtags || 0,
        minInterval: config.contentRules?.minInterval || 300000
      }
    };
  }

  async initialize(): Promise<void> {
    try {
      elizaLogger.info('Initializing Twitter service...');

      // Verify credentials before proceeding
      await this.verifyCredentials();
      
      elizaLogger.info(`Twitter bot initialized as @${this.username}`);

    } catch (error) {
      elizaLogger.error('Failed to initialize Twitter service:', error);
      throw error;
    }
  }

  private async verifyCredentials(): Promise<void> {
    if (this.config.mockMode) {
      elizaLogger.info('Running in mock mode - skipping Twitter authentication');
      return;
    }

    try {
      // Test direct authentication
      const userClient = await this.client.v2.me();
      elizaLogger.info('Direct authentication successful');

      // Verify account access
      const settings = await this.client.v2.userByUsername(this.username);
      elizaLogger.info('Account access verified');

    } catch (error: any) {
      if (error.code === 399) {
        elizaLogger.info(`
          ACID challenge detected (Error 399) - this is normal for direct authentication.
          The system will handle this automatically.
        `);
      } else if (error.code === 403) {
        elizaLogger.error(`
          Authentication error. Please ensure:
          1. Your Twitter credentials are correct
          2. Your account is not locked or restricted
          3. You have completed any required verification steps
          
          Note: A "suspicious login" notification is normal and indicates successful authentication.
        `);
      } else if (error.code === 429) {
        elizaLogger.error('Rate limit exceeded. Waiting before retry.');
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
      }
      throw error;
    }
  }

  /**
   * Upload media using Twitter API
   * Note: Currently using v1 endpoint as v2 doesn't fully support direct media uploads yet
   * TODO: Migrate to v2 media endpoints when they become available
   * @param mediaUrls Array of media URLs to upload
   * @returns Array of media IDs
   */
  private async uploadMedia(mediaUrls: string[]): Promise<string[]> {
    let attempt = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 5000; // 5 seconds

    while (attempt < MAX_RETRIES) {
      try {
        // Still using v1 endpoint as v2 doesn't have a direct replacement yet
        const mediaIds = await Promise.all(
          mediaUrls.map(url => this.client.v1.uploadMedia(url))
        );
        elizaLogger.info('Successfully uploaded media using v1 endpoint');
        return mediaIds;
      } catch (error) {
        attempt++;
        if (error instanceof ApiResponseError && error.rateLimitError && attempt < MAX_RETRIES) {
          elizaLogger.warn(`Rate limit hit, waiting ${RETRY_DELAY}ms before retry ${attempt}/${MAX_RETRIES}`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          continue;
        }
        elizaLogger.error('Error uploading media:', error);
        throw error;
      }
    }
    throw new Error('Failed to upload media after maximum retries');
  }

  /**
   * Post a tweet using Twitter API v2
   * @param content Tweet text content
   * @param options Optional parameters including media URLs
   */
  async tweet(content: string, options: { mediaUrls?: string[] } = {}): Promise<TweetV2PostTweetResult> {
    if (this.config.mockMode) {
      elizaLogger.info('Mock mode - logging tweet instead of posting:', content);
      return { data: { id: 'mock_tweet_id', text: content } } as TweetV2PostTweetResult;
    }

    // Validate content against rules
    const emojiCount = (content.match(/[\p{Emoji}]/gu) || []).length;
    const hashtagCount = (content.match(/#\w+/g) || []).length;

    if (emojiCount > this.config.contentRules.maxEmojis) {
      throw new Error(`Tweet contains ${emojiCount} emojis, exceeding limit of ${this.config.contentRules.maxEmojis}`);
    }
    if (hashtagCount > this.config.contentRules.maxHashtags) {
      throw new Error(`Tweet contains ${hashtagCount} hashtags, exceeding limit of ${this.config.contentRules.maxHashtags}`);
    }

    let attempt = 0;
    while (attempt < this.config.maxRetries) {
      try {
        let mediaIds: string[] = [];
        
        if (options.mediaUrls && options.mediaUrls.length > 0) {
          mediaIds = await this.uploadMedia(options.mediaUrls);
        }

        // Create tweet payload using SendTweetV2Params interface
        const tweetPayload: SendTweetV2Params = {
          text: content,
          ...(mediaIds.length > 0 && {
            media_ids: mediaIds  // Media IDs at root level for v2 API
          })
        };
        
        const tweet = await this.client.v2.tweet(tweetPayload);
        
        elizaLogger.info('Successfully posted tweet:', tweet.data.id);
        return tweet;
      } catch (error) {
        attempt++;
        if (error instanceof ApiResponseError && error.rateLimitError && attempt < this.config.maxRetries) {
          elizaLogger.warn(`Rate limit hit, waiting ${this.config.retryDelay}ms before retry ${attempt}/${this.config.maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
          continue;
        }
        elizaLogger.error('Failed to post tweet:', error);
        throw error;
      }
    }
    throw new Error('Failed to post tweet after maximum retries');
  }

  async reply(messageId: string, content: string): Promise<void> {
    try {
      await this.client.v2.reply(content, messageId);
      elizaLogger.info('Successfully replied to tweet');
    } catch (error) {
      elizaLogger.error('Failed to reply to tweet:', error);
      throw error;
    }
  }

  private async setupStreamRules(): Promise<void> {
    try {
      // Always use appOnlyClient for stream rules
      const rules = await this.appOnlyClient.v2.streamRules();
      
      // Clear existing rules
      if (rules.data?.length) {
        await this.appOnlyClient.v2.updateStreamRules({
          delete: { ids: rules.data.map(rule => rule.id) }
        });
      }

      // Set new rules using app-only client
      await this.appOnlyClient.v2.updateStreamRules({
        add: [
          { value: `@${this.username}`, tag: 'mentions' }
        ]
      });

      elizaLogger.info('Twitter stream rules set successfully');
    } catch (error: any) {
      if (error.code === 403 && error.data?.title === 'Unsupported Authentication') {
        elizaLogger.error('Authentication error: Using app-only client for stream rules');
      }
      throw error;
    }
  }

  async startStream(): Promise<void> {
    if (this.isStreaming) {
      elizaLogger.warn('Twitter stream is already running');
      return;
    }

    try {
      elizaLogger.info('Starting Twitter stream...');

      // Set up stream rules first
      await this.setupStreamRules();

      // Create stream with app-only client
      const stream = await this.appOnlyClient.v2.searchStream({
        'tweet.fields': ['referenced_tweets', 'author_id', 'created_at'],
        'user.fields': ['username'],
        expansions: ['referenced_tweets.id', 'author_id']
      });

      this.isStreaming = true;
      elizaLogger.success('Twitter stream started successfully');

      stream.on('data', async tweet => {
        try {
          // Process incoming tweets
          await this.handleTweet(tweet);
        } catch (error) {
          elizaLogger.error('Error processing tweet:', error);
        }
      });

      stream.on('error', error => {
        elizaLogger.error('Stream error:', error);
        this.isStreaming = false;
        // Attempt to restart stream after delay
        setTimeout(() => this.startStream(), 30000);
      });

    } catch (error: any) {
      if (error.data?.reason === 'client-not-enrolled') {
        elizaLogger.error(`
          Twitter API access error. Your App must be attached to a Project in the Twitter Developer Portal.
          Please ensure:
          1. Your App is attached to a Project
          2. You have the appropriate level of API access
          
          Visit: https://developer.twitter.com/en/docs/projects/overview
        `);
      } else if (error.code === 429) {
        elizaLogger.error('Rate limit exceeded. Please try again later.');
      } else if (error.code === 403 && error.data?.title === 'Unsupported Authentication') {
        elizaLogger.error(`
          Unsupported Authentication. Please ensure you are using OAuth 2.0 Application-Only authentication for this endpoint.
          Visit: https://developer.twitter.com/en/docs/authentication/oauth-2-0
        `);
      }
      elizaLogger.error('Error starting stream:', error);
      this.isStreaming = false;
      throw error;
    }
  }

  private async handleTweet(tweet: any): Promise<void> {
    // Don't respond to our own tweets
    if (tweet.data.author_id === await this.getUserId()) {
      return;
    }

    try {
      const response = await this.aiService.generateResponse({
        content: tweet.data.text,
        platform: 'twitter',
        author: tweet.data.author_id,
        messageId: tweet.data.id // Ensure this property is included in the type definition
      });

      if (response) {
        await this.client.v2.reply(response, tweet.data.id);
      }
    } catch (error) {
      elizaLogger.error('Error handling tweet:', error);
    }
  }

  private async getUserId(): Promise<string> {
    try {
      const user = await this.client.v2.userByUsername(this.username);
      return user.data.id;
    } catch (error) {
      elizaLogger.error('Error getting user ID:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.isStreaming) {
        // Clean up rules when stopping
        const rules = await this.appOnlyClient.v2.streamRules();
        if (rules.data?.length) {
          await this.appOnlyClient.v2.updateStreamRules({
            delete: { ids: rules.data.map(rule => rule.id) }
          });
        }
      }
      
      this.isStreaming = false;
      elizaLogger.info('Twitter stream stopped');
    } catch (error) {
      elizaLogger.error('Error stopping Twitter service:', error);
      throw error;
    }
  }
}
