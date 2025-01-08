import { 
  TwitterApi, 
  ApiResponseError, 
  TweetV2PostTweetResult, 
  SendTweetV2Params
} from 'twitter-api-v2';
import { AIService } from '../ai';
import { elizaLogger } from "@ai16z/eliza";
import { MarketUpdateData } from '@/types/market';

interface TwitterConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
  bearerToken: string;
  oauthClientId: string;
  oauthClientSecret: string;
  mockMode?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  contentRules?: ContentRules;
  streamingEnabled?: boolean; // Make streaming optional
}

interface ContentRules {
  maxEmojis: number;
  maxHashtags: number;
  minInterval: number;
}

interface TweetOptions {
  mediaUrls?: string[];
  replyToTweetId?: string; // Allow string or undefined
}

export class TwitterService {
  private userClient: TwitterApi;
  private appClient: TwitterApi;
  private aiService: AIService;
  private isStreaming: boolean = false;
  private readonly config: Required<TwitterConfig>;
  private userId?: string;
  private readonly MONTHLY_TWEET_LIMIT: number = 3000; // Define the monthly tweet limit
  
  constructor(config: TwitterConfig, aiService: AIService) {
    this.validateConfig(config);
    
    this.config = {
      ...config,
      mockMode: config.mockMode ?? false,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 5000,
      streamingEnabled: config.streamingEnabled ?? false,
      contentRules: {
        maxEmojis: config.contentRules?.maxEmojis ?? 0,
        maxHashtags: config.contentRules?.maxHashtags ?? 0,
        minInterval: config.contentRules?.minInterval ?? 300000
      }
    };

    this.aiService = aiService;

    // Initialize clients with OAuth 2.0 authentication
    this.userClient = new TwitterApi({
      clientId: config.oauthClientId,
      clientSecret: config.oauthClientSecret
    });

    // Initialize app-only client
    this.appClient = new TwitterApi(config.bearerToken);
  }

  private validateConfig(config: TwitterConfig): void {
    const requiredFields: (keyof TwitterConfig)[] = [
      'apiKey', 'apiSecret',
      'accessToken', 'accessSecret',
      'bearerToken',
      'oauthClientId', 'oauthClientSecret'
    ];

    const missing = requiredFields.filter(field => !config[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required Twitter configuration fields: ${missing.join(', ')}`);
    }
  }

  async initialize(): Promise<void> {
    try {
      elizaLogger.info('Initializing Twitter service...');

      if (!this.config.mockMode) {
        await this.initializeWithRetry();
      }

      elizaLogger.success('Twitter service initialized successfully');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      elizaLogger.error('Failed to initialize Twitter service:', msg);
      throw error;
    }
  }

  private async initializeWithRetry(maxRetries = 3): Promise<void> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        await this.verifyUserAuth();
        return;
      } catch (error) {
        attempt++;
        if (error instanceof ApiResponseError && error.code === 429) {
          const resetTime = this.getRateLimitReset(error);
          if (resetTime) {
            const waitTime = resetTime - Date.now();
            if (waitTime > 0) {
              elizaLogger.info(`Rate limit hit. Waiting ${Math.ceil(waitTime / 1000)} seconds before retry...`);
              await this.delay(waitTime);
              continue;
            }
          }
        }
        throw error;
      }
    }
    throw new Error(`Failed to initialize after ${maxRetries} attempts`);
  }

  private getRateLimitReset(error: ApiResponseError): number | null {
    try {
      const resetHeader = error.rateLimit?.reset;
      if (resetHeader) {
        return resetHeader * 1000; // Convert to milliseconds
      }
      return null;
    } catch {
      return null;
    }
  }

  private async verifyUserAuth(): Promise<void> {
    try {
      const me = await this.userClient.v2.me();
      this.userId = me.data.id;
      elizaLogger.success(`User authentication verified for @${me.data.username}`);
    } catch (error) {
      this.handleAuthError(error, 'User authentication');
      throw error;
    }
  }

  private handleAuthError(error: unknown, context: string): void {
    if (error instanceof ApiResponseError) {
      switch (error.code) {
        case 401:
          elizaLogger.error(`${context} failed: Unauthorized. Check your credentials.`);
          break;
        case 403:
          elizaLogger.error(`${context} failed: Forbidden. Check your API permissions.`);
          break;
        case 429:
          elizaLogger.error(`${context} failed: Rate limit exceeded. Try again later.`);
          break;
        default:
          elizaLogger.error(`${context} failed with code ${error.code}:`, error.data);
      }
    } else {
      elizaLogger.error(`${context} failed with unexpected error:`, error);
    }
  }

  private async verifyAppAuth(): Promise<void> {
    try {
      // Use a simple search query to verify app-only auth
      await this.appClient.v2.search('test');
      elizaLogger.success('App-only authentication verified');
    } catch (error) {
      this.handleAuthError(error, 'App-only authentication');
      throw error;
    }
  }

  async startStream(): Promise<void> {
    if (!this.config.streamingEnabled) {
      elizaLogger.warn(`
        Twitter streaming is not enabled. 
        To enable streaming functionality, you need:
        1. Elevated API access level
        2. App attached to a Project
        Visit: https://developer.twitter.com/en/portal/projects-and-apps
      `);
      return;
    }

    if (this.isStreaming) {
      elizaLogger.warn('Twitter stream is already running');
      return;
    }

    try {
      elizaLogger.info('Starting Twitter stream...');
      await this.setupStreamRules();

      const stream = await this.appClient.v2.searchStream({
        'tweet.fields': ['referenced_tweets', 'author_id', 'created_at'],
        'user.fields': ['username'],
        expansions: ['referenced_tweets.id', 'author_id']
      });

      this.isStreaming = true;
      elizaLogger.success('Twitter stream started successfully');

      stream.on('data', this.handleStreamData.bind(this));
      stream.on('error', this.handleStreamError.bind(this));

    } catch (error) {
      // If we get a 403 error, disable streaming
      if (error instanceof ApiResponseError && error.code === 403) {
        this.config.streamingEnabled = false;
        elizaLogger.warn(`
          Stream setup failed due to insufficient API access.
          Streaming has been disabled.
          Basic tweet functionality will continue to work.
        `);
      } else {
        this.handleStreamSetupError(error);
        throw error;
      }
    }
  }

  private async setupStreamRules(): Promise<void> {
    try {
      const rules = await this.appClient.v2.streamRules();
      
      if (rules.data?.length) {
        await this.appClient.v2.updateStreamRules({
          delete: { ids: rules.data.map(rule => rule.id) }
        });
      }

      const me = await this.userClient.v2.me();
      await this.appClient.v2.updateStreamRules({
        add: [
          { value: `@${me.data.username}`, tag: 'mentions' }
        ]
      });

      elizaLogger.success('Stream rules configured successfully');
    } catch (error) {
      elizaLogger.error('Failed to configure stream rules:', error);
      throw error;
    }
  }

  private async handleStreamData(tweet: any): Promise<void> {
    try {
      if (!this.userId) {
        const me = await this.userClient.v2.me();
        this.userId = me.data.id;
      }
      
      if (tweet.data.author_id === this.userId) return;

      const response = await this.aiService.generateResponse({
        content: tweet.data.text,
        platform: 'twitter',
        author: tweet.data.author_id,
        messageId: tweet.data.id
      });

      if (response) {
        await this.tweet(response, { replyToTweetId: tweet.data.id });
        elizaLogger.info('Successfully replied to tweet');
      }
    } catch (error) {
      elizaLogger.error('Error processing stream data:', error);
    }
  }

  private handleStreamError(error: Error): void {
    elizaLogger.error('Stream error:', error);
    this.isStreaming = false;
    
    setTimeout(() => {
      if (!this.isStreaming) {
        this.startStream().catch(e => 
          elizaLogger.error('Failed to restart stream:', e)
        );
      }
    }, this.config.retryDelay);
  }

  private handleStreamSetupError(error: unknown): void {
    if (error instanceof ApiResponseError) {
      switch (error.code) {
        case 403:
          elizaLogger.error(`
            Stream setup failed: Access forbidden
            Please ensure your App is configured for all required permissions
            Visit: https://developer.twitter.com/en/docs/twitter-api/getting-started/about-twitter-api
          `);
          break;
        case 429:
          elizaLogger.error('Stream setup failed: Rate limit exceeded. Please try again later.');
          break;
        default:
          elizaLogger.error('Stream setup failed:', error);
      }
    } else {
      elizaLogger.error('Unexpected error during stream setup:', error);
    }
  }

  private shouldRetry(error: unknown, attempt: number): boolean {
    return (
      attempt < this.config.maxRetries &&
      error instanceof ApiResponseError &&
      (error.rateLimitError || error.code === 429)
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async stop(): Promise<void> {
    elizaLogger.info('Twitter service stopped');
  }

  getTweetCount(): number {
    return this.getTweetCount();
  }

  getRemainingTweets(): number {
    return this.MONTHLY_TWEET_LIMIT - this.getTweetCount();
  }

  async tweet(content: string, options: TweetOptions = {}): Promise<TweetV2PostTweetResult> {
    if (this.config.mockMode) {
      elizaLogger.info('Mock mode - logging tweet:', content);
      return { data: { id: 'mock_tweet_id', text: content } } as TweetV2PostTweetResult;
    }
  
    await this.validateTweetContent(content);
    let attempt = 0;
  
    while (attempt < this.config.maxRetries) {
      try {
        const mediaIds = options.mediaUrls ? await this.uploadMedia(options.mediaUrls) : [];
  
        const tweetPayload: SendTweetV2Params = {
          text: content,
          ...(mediaIds.length && { media: { media_ids: mediaIds as [string] | [string, string] | [string, string, string] | [string, string, string, string] } }),
          ...(options.replyToTweetId && { reply: { in_reply_to_tweet_id: options.replyToTweetId } })
        };
  
        const tweet = await this.userClient.v2.tweet(tweetPayload);
        
        elizaLogger.success('Tweet posted successfully:', tweet.data.id);
        return tweet;
      } catch (error) {
        attempt++;
        
        if (this.shouldRetry(error, attempt)) {
          await this.delay(this.config.retryDelay * attempt);
          continue;
        }
        
        elizaLogger.error('Failed to post tweet:', error);
        throw error;
      }
    }
  
    throw new Error(`Failed to post tweet after ${this.config.maxRetries} attempts`);
  }
  validateTweetContent(content: string) {
    throw new Error('Method not implemented.');
  }
  private async uploadMedia(urls: string[]): Promise<string[]> {
    const uploadPromises = urls.map(async url => {
      let attempt = 0;
      while (attempt < this.config.maxRetries) {
        try {
          return await this.userClient.v1.uploadMedia(url);
        } catch (error) {
          attempt++;
          if (this.shouldRetry(error, attempt)) {
            await this.delay(this.config.retryDelay * attempt);
            continue;
          }
          throw error;
        }
      }
      throw new Error(`Failed to upload media ${url} after ${this.config.maxRetries} attempts`);
    });
  
    return Promise.all(uploadPromises);
  }

  async publishMarketUpdate(data: MarketUpdateData): Promise<void> {
    const content = `Market Update:
    - Price: ${data.price}
    - 24h Volume: ${data.volume24h}
    - 24h Price Change: ${data.priceChange24h}
    - Market Cap: ${data.marketCap}
    - Top Holders: ${data.topHolders.join(', ')}`;

    await this.tweet(content);
  }
}