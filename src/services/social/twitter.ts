import { TwitterApi, ApiResponseError } from 'twitter-api-v2';
import { AIService } from '../ai';
import { elizaLogger } from "@ai16z/eliza";

interface TwitterConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
  bearerToken: string;
  username: string;
}

export class TwitterService {
  private client: TwitterApi;
  private appOnlyClient: TwitterApi;
  private aiService: AIService;
  private username: string;
  private isStreaming: boolean = false;

  constructor(config: TwitterConfig, aiService: AIService) {
    // User authentication client
    this.client = new TwitterApi({
      appKey: config.apiKey,
      appSecret: config.apiSecret,
      accessToken: config.accessToken,
      accessSecret: config.accessSecret
    });

    // App-only authentication client (for elevated access)
    this.appOnlyClient = new TwitterApi(config.bearerToken);
    
    this.aiService = aiService;
    this.username = config.username;
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
    try {
      // Test user authentication
      const userClient = await this.client.v2.me();
      elizaLogger.info('User authentication successful');

      // Test app-only authentication
      const appOnlyTest = await this.appOnlyClient.v2.search('test');
      elizaLogger.info('App-only authentication successful');

      // Verify required permissions
      const settings = await this.client.v2.userByUsername(this.username);
      elizaLogger.info('Required permissions verified');

    } catch (error: any) {
      if (error.code === 403) {
        elizaLogger.error(`
          Twitter API access error. Please ensure:
          1. You have a Twitter Developer Account
          2. Created a Project in the Twitter Developer Portal
          3. Created an App within that Project
          4. Enabled OAuth 1.0a
          5. Generated tokens with Read and Write permissions
          6. Your App has Elevated access level
          
          Visit: https://developer.twitter.com/en/portal/projects-and-apps
        `);
      } else if (error.data?.reason === 'client-not-enrolled') {
        elizaLogger.error(`
          Twitter API access error. Your App must be attached to a Project in the Twitter Developer Portal.
          Please ensure:
          1. Your App is attached to a Project
          2. You have the appropriate level of API access
          
          Visit: https://developer.twitter.com/en/docs/projects/overview
        `);
      } else if (error.code === 429) {
        elizaLogger.error('Rate limit exceeded. Please try again later.');
      }
      throw error;
    }
  }

  async tweet(content: string): Promise<void> {
    try {
      // First try a regular tweet
      await this.client.v2.tweet(content);
      elizaLogger.info('Successfully posted tweet');
    } catch (error) {
      elizaLogger.error('Failed to post tweet:', error);
      throw error;
    }
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