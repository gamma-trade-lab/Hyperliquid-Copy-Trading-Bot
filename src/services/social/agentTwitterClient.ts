import { Scraper } from 'agent-twitter-client';
import { TwitterStreamEvent } from '../../types/twitter';
import { TwitterStreamHandler } from './TwitterStreamHandler';
import { AIService } from '../ai/ai';

export class AgentTwitterClientService {
  private scraper: Scraper | null = null;
  private isInitialized = false;
  private streamHandler: TwitterStreamHandler | null = null;

  constructor(
    private readonly username: string,
    private readonly password: string,
    private readonly email: string,
    private readonly aiService: AIService
  ) {}

  public async initialize(): Promise<void> {
    try {
      this.scraper = new Scraper();
      
      await this.scraper.login(
        this.username,
        this.password,
        this.email
      );
      
      // Initialize stream handler
      this.streamHandler = new TwitterStreamHandler(this, this.aiService);
      
      this.isInitialized = true;
      console.log('AgentTwitterClientService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AgentTwitterClientService:', error);
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
        console.log('Tweet sent successfully');
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
}
