import { 
  TwitterApi, 
  ApiResponseError, 
  TweetV2PostTweetResult, 
  SendTweetV2Params,
  ApiRequestError, 
  ApiPartialResponseError 
} from 'twitter-api-v2';
import { AIService } from '../ai/ai';
import { elizaLogger } from "@ai16z/eliza";
import { MarketUpdateData } from '@/types/market';
import { MarketDataProcessor } from '../market/data/DataProcessor';
import { PriceMonitor } from '../market/analysis/priceMonitor';
import { JupiterPriceV2Service, TokenInfo } from '../blockchain/defi/JupiterPriceV2Service';
import { HeliusService } from '../blockchain/heliusIntegration';

export interface MarketMetrics {
  price: number;
  volume24h: number;
  priceChange24h: number;
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

interface TwitterServiceConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
  bearerToken: string;
  oauthClientId: string;
  oauthClientSecret: string;
  mockMode: boolean;
  maxRetries: number;
  retryDelay: number;
  baseUrl: string;
  contentRules: {
    maxEmojis: number;
    maxHashtags: number;
    minInterval: number;
  };
  marketDataConfig: {
    heliusApiKey: string;
    updateInterval: number;
    volatilityThreshold: number;
  };
  tokenAddresses: string[];
}

export class TwitterService {
  postTweet(tweetContent: string, arg1: { mediaUrls: string[]; }) {
      throw new Error('Method not implemented.');
  }
  postTweetWithRetry(tweetContent: string) {
    throw new Error('Method not implemented.');
  }
  private userClient: TwitterApi;
  private appClient: TwitterApi;
  private aiService: AIService;
  //private jupiterService: JupiterPriceV2Service;
  //private heliusService: HeliusService;
  private isStreaming: boolean = false;
  private readonly config: Required<TwitterServiceConfig>;
  private userId?: string;
  private readonly MONTHLY_TWEET_LIMIT: number = 3000; // Define the monthly tweet limit
  
  private dataProcessor: MarketDataProcessor;
  private priceMonitor: PriceMonitor;
  private marketUpdateInterval: NodeJS.Timeout | null = null;

  constructor(
    config: TwitterServiceConfig, 
    aiService: AIService,
    dataProcessor: MarketDataProcessor,
  ) {
    this.validateConfig(config);
    
    this.config = {
      ...config,
      mockMode: config.mockMode ?? false,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 5000,
      baseUrl: config.baseUrl ?? 'https://api.twitter.com', // Add default baseUrl
      contentRules: {
        maxEmojis: config.contentRules?.maxEmojis ?? 0,
        maxHashtags: config.contentRules?.maxHashtags ?? 0,
        minInterval: config.contentRules?.minInterval ?? 300000
      },
      marketDataConfig: {
        updateInterval: config.marketDataConfig?.updateInterval ?? 60000,
        volatilityThreshold: config.marketDataConfig?.volatilityThreshold ?? 0.05,
        heliusApiKey: config.marketDataConfig?.heliusApiKey ?? ''
      },
      tokenAddresses: config.tokenAddresses ?? []
    } as Required<TwitterServiceConfig>;

    this.aiService = aiService;
    this.dataProcessor = dataProcessor;
    //this.jupiterService = jupiterService;
    //this.heliusService = heliusService;
    this.priceMonitor = new PriceMonitor(dataProcessor, aiService);
    this.setupMarketMonitoring();

    // Initialize clients with OAuth 2.0 authentication
    this.userClient = new TwitterApi({
      appKey: config.apiKey,
      appSecret: config.apiSecret,
      accessToken: config.accessToken,
      accessSecret: config.accessSecret
    });

    // Initialize app-only client
    this.appClient = new TwitterApi(config.bearerToken);
  }

  private validateConfig(config: TwitterServiceConfig): void {
    const requiredFields: (keyof TwitterServiceConfig)[] = [
      'apiKey', 'apiSecret',
      'accessToken', 'accessSecret',
      'bearerToken',
      'oauthClientId', 'oauthClientSecret',
      'baseUrl'
    ];

    const missing = requiredFields.filter(field => !config[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required Twitter configuration fields: ${missing.join(', ')}`);
    }
  }

  private setupMarketMonitoring(): void {
    // Handle significant price movements
    this.priceMonitor.on('significantMovement', async ({ tokenAddress, analysis }) => {
      try {
        const marketData = await this.dataProcessor.formatForAI(tokenAddress);
        
        const content = await this.aiService.generateResponse({
          content: `Generate market movement tweet:\n${marketData}\nAnalysis: ${analysis}`,
          platform: 'twitter',
          author: 'system',
        });

        await this.tweet(content);
      } catch (error) {
        elizaLogger.error('Failed to tweet market movement:', error);
      }
    });

    // Handle price alerts
    this.priceMonitor.on('alertTriggered', async ({ alert, pricePoint }) => {
      try {
        const marketData = await this.dataProcessor.formatForAI(alert.token);
        
        const content = await this.aiService.generateResponse({
          content: `Generate price alert tweet:\n${marketData}\nAlert: ${alert.condition} at ${pricePoint.price}`,
          platform: 'twitter',
          author: 'system',
        });

        await this.tweet(content);
      } catch (error) {
        elizaLogger.error('Failed to tweet price alert:', error);
      }
    });
  }

  async startMarketUpdates(
    tokenAddress: string, 
    interval: number = 1800000 // 30 minutes
  ): Promise<void> {
    try {
      // Start price monitoring
      await this.priceMonitor.startMonitoring(tokenAddress);

      // Schedule regular market updates
      this.marketUpdateInterval = setInterval(async () => {
        try {
          const formattedData = await this.dataProcessor.formatForAI(tokenAddress);
          
          const content = await this.aiService.generateResponse({
            content: `Generate market update tweet with this data:\n${formattedData}`,
            platform: 'twitter',
            author: 'system',
          });

          await this.tweet(content);
        } catch (error) {
          elizaLogger.error('Failed to post market update:', error);
        }
      }, interval);

      elizaLogger.info(`Started market updates for ${tokenAddress}`);
    } catch (error) {
      elizaLogger.error('Failed to start market updates:', error);
      throw error;
    }
  }

  async stopMarketUpdates(): Promise<void> {
    if (this.marketUpdateInterval) {
      clearInterval(this.marketUpdateInterval);
      this.marketUpdateInterval = null;
    }
    
    // Cleanup price monitor
    this.priceMonitor.cleanup();
    elizaLogger.info('Market updates stopped');
  }

  async publishMarketUpdate(data: MarketUpdateData): Promise<void> {
      try {
        const formattedData = await this.dataProcessor.formatForAI(data.tokenAddress as unknown as string);
      
      const content = await this.aiService.generateResponse({
        content: `Generate market update tweet with this data:\n${formattedData}`,
        platform: 'twitter',
        author: 'system',
      });

      await this.tweet(content);
    } catch (error) {
      elizaLogger.error('Failed to publish market update:', error);
      throw error;
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
    } else if (error instanceof ApiRequestError) {
      elizaLogger.error(`${context} failed: Request error.`, error.requestError);
    } else if (error instanceof ApiPartialResponseError) {
      elizaLogger.error(`${context} failed: Partial response error.`, error.responseError);
    } else {
      elizaLogger.error(`${context} failed with unexpected error:`, error);
    }
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

  private validateTweetContent(content: string): void {
    const { maxEmojis = 0, maxHashtags = 0 } = this.config.contentRules;

    const emojiCount = (content.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length;
    const hashtagCount = (content.match(/#/g) || []).length;

    if (emojiCount > maxEmojis) {
      throw new Error(`Tweet contains too many emojis. Maximum allowed is ${maxEmojis}.`);
    }

    if (hashtagCount > maxHashtags) {
      throw new Error(`Tweet contains too many hashtags. Maximum allowed is ${maxHashtags}.`);
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

  private async uploadMedia(urls: string[]): Promise<string[]> {
    // Implement media upload logic
    return [];
  }

  async startStream(): Promise<void> {
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

  async stop(): Promise<void> {
    elizaLogger.info('Twitter service stopped');
  }

  getTweetCount(): number {
    return this.getTweetCount();
  }

  getRemainingTweets(): number {
    return this.MONTHLY_TWEET_LIMIT - this.getTweetCount();
  }

     
    }
