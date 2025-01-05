import { Scraper, SearchMode } from 'agent-twitter-client';
import { TwitterStreamEvent } from '../../types/twitter';
import { TwitterStreamHandler } from './TwitterStreamHandler';
import { AIService } from '../ai/ai';

export class AgentTwitterClientService {
  private scraper: Scraper | null = null;
  private isInitialized = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private streamHandler: TwitterStreamHandler | null = null;

  constructor(
    private readonly username: string,
    private readonly password: string,
    private readonly email: string,
    private readonly aiService: AIService
  ) {}

  public async initialize(): Promise<void> {
    try {
      console.log('Initializing Twitter client...');
      this.scraper = new Scraper();
      
      await this.scraper.login(
        this.username,
        this.password,
        this.email
      );
      
      // Initialize stream handler
      this.streamHandler = new TwitterStreamHandler(this, this.aiService);
      
      // Start the stream
      await this.startStream();
      
      this.isInitialized = true;
      console.log('Twitter client initialized successfully', {
        username: this.username,
        hasPassword: !!this.password,
        hasEmail: !!this.email,
        isAuthenticated: true,
        streamActive: true
      });
    } catch (error) {
      console.error('Failed to initialize Twitter client:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        username: this.username,
        hasPassword: !!this.password,
        hasEmail: !!this.email
      });
      throw new Error(`Twitter client initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized || !this.scraper) {
      throw new Error('AgentTwitterClientService not initialized. Call initialize() first.');
    }
  }

  public async sendTweet(content: string): Promise<void> {
    this.ensureInitialized();
    try {
      if (this.scraper) {
        await this.scraper.sendTweet(content);
        console.log('Tweet sent successfully', { contentLength: content.length });
      }
    } catch (error) {
      console.error('Failed to send tweet:', error);
      throw new Error(`Failed to send tweet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Alias for sendTweet to maintain compatibility with MarketTweetCron
  public async postTweet(content: string): Promise<void> {
    return this.sendTweet(content);
  }

  public async replyToTweet(tweetId: string, content: string, username: string): Promise<void> {
    this.ensureInitialized();
    try {
      if (this.scraper) {
        // Format the reply with the username mention
        const replyContent = username.startsWith('@') ? `${username} ${content}` : `@${username} ${content}`;
        await this.scraper.sendTweet(replyContent);
        console.log('Reply sent successfully');
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
      throw new Error(`Failed to send reply: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async likeTweet(tweetId: string): Promise<void> {
    this.ensureInitialized();
    try {
      if (this.scraper) {
        await this.scraper.likeTweet(tweetId);
        console.log('Tweet liked successfully');
      }
    } catch (error) {
      console.error('Failed to like tweet:', error);
      throw new Error(`Failed to like tweet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async retweet(tweetId: string): Promise<void> {
    this.ensureInitialized();
    try {
      if (this.scraper) {
        await this.scraper.retweet(tweetId);
        console.log('Retweet sent successfully');
      }
    } catch (error) {
      console.error('Failed to retweet:', error);
      throw new Error(`Failed to retweet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async startStream(): Promise<void> {
    if (!this.scraper || !this.streamHandler) {
      throw new Error('Cannot start stream: Twitter client or stream handler not initialized');
    }

    try {
      console.log('Starting Twitter monitoring...');
      
      // Initialize last checked timestamp
      let lastChecked = Date.now();
      let isMonitoring = true;
      
      // Poll for new tweets every 30 seconds
      const pollInterval = setInterval(async () => {
        if (!isMonitoring) return;
        
        try {
          const tweetGenerator = this.scraper.searchTweets('', 20, SearchMode.Latest);
          
          // Process tweets from the generator
          for await (const tweet of tweetGenerator) {
            if (!isMonitoring) break;
            
            const tweetTimestamp = Date.now(); // Use current time for polling
            
            // Only process tweets newer than our last check
            if (tweetTimestamp > lastChecked) {
              const tweetEvent = {
                id: tweet.id.toString(),
                text: tweet.text || '',
                created_at: new Date(tweetTimestamp).toISOString()
              };
              
              await this.streamHandler?.handleTweetEvent(tweetEvent);
            }
          }
          
          lastChecked = Date.now();
        } catch (error) {
          console.error('Error polling tweets:', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }, 30000);
      
      // Store interval for cleanup
      this.monitoringInterval = pollInterval;
      this.isMonitoring = isMonitoring;

      console.log('Twitter monitoring started successfully');

    } catch (error) {
      console.error('Failed to start Twitter stream:', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  public async getProfile(username: string): Promise<any> {
    this.ensureInitialized();
    try {
      if (this.scraper) {
        const profile = await this.scraper.getProfile(username);
        return profile;
      }
      throw new Error('Scraper not initialized');
    } catch (error) {
      console.error('Failed to get profile:', error);
      throw new Error(`Failed to get profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
