import { Scraper, SearchMode, Profile } from 'agent-twitter-client';
import { TwitterStreamEvent } from '../../types/twitter';
import type { TwitterResponse, TwitterProfile, TwitterCookies } from './agentTwitterClient.types';
import { TwitterStreamHandler } from './TwitterStreamHandler';
import { AIService } from '../ai/ai';

export class AgentTwitterClientService {
  private scraper: Scraper | null = null;
  private isInitialized = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private streamHandler: TwitterStreamHandler | null = null;

  constructor(
    private username: string,
    private readonly password: string,
    private readonly email: string,
    private readonly aiService: AIService
  ) {
    // Remove @ from username if present
    this.username = this.username.startsWith('@') ? this.username.substring(1) : this.username;
    
    console.log('Twitter client configured with:', {
      username: this.username,
      hasPassword: !!this.password,
      hasEmail: !!this.email
    });
  }

  private getSanitizedUsername(): string {
    return this.username.startsWith('@') ? this.username.substring(1) : this.username;
  }

  private async loadCookies(): Promise<boolean> {
    try {
      if (!this.scraper) return false;
      const cookies = await this.scraper.getCookies();
      if (cookies && cookies.length > 0) {
        await this.scraper.setCookies(cookies);
        return true;
      }
      return false;
    } catch (error) {
      console.warn('Failed to load cookies:', error);
      return false;
    }
  }

  private async attemptLogin(retries = 5): Promise<void> {
    if (!this.scraper) throw new Error('Scraper not initialized');
    
    let lastError: unknown;
    for (let i = 0; i < retries; i++) {
      try {
        if (i > 0) {
          const baseDelay = Math.min(30000 * Math.pow(2, i), 120000);
          const jitter = Math.random() * 15000;
          const delay = baseDelay + jitter;
          console.log(`Waiting ${Math.round(delay)}ms before attempt ${i + 1}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        await this.scraper.clearCookies();
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log(`Attempting login with username: ${this.getSanitizedUsername()}`);
        
        const existingCookies = await this.loadCookies();
        if (existingCookies) {
          console.log('Attempting to use existing session...');
          try {
            const isLoggedIn = await this.scraper.isLoggedIn();
            if (isLoggedIn) {
              console.log('Existing session valid, skipping login');
              return;
            }
          } catch (error) {
            console.warn('Session validation failed:', error);
          }
        }

        console.log('Setting up authentication with credentials:', {
          username: !!this.username,
          email: !!this.email,
          hasPassword: !!this.password
        });

        try {
          await this.scraper.login(
            this.getSanitizedUsername(),
            this.password,
            this.email
          );
          
          await new Promise(resolve => setTimeout(resolve, 10000));
          
          let loginVerified = false;
          for (let verifyAttempt = 0; verifyAttempt < 3; verifyAttempt++) {
            try {
              const isLoggedIn = await this.scraper.isLoggedIn();
              if (isLoggedIn) {
                loginVerified = true;
                break;
              }
            } catch (error) {
              console.warn(`Login verification attempt ${verifyAttempt + 1} failed:`, error);
            }
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
          
          if (!loginVerified) {
            throw new Error('Login verification failed after multiple attempts');
          }
          
          console.log('Login successful and verified');
          return;
        } catch (error: any) {
          console.warn(`Login attempt ${i + 1} failed:`, error);
          
          if (error?.message?.includes('code":399')) {
            console.log('ACID challenge detected, adding delay before retry...');
            await new Promise(resolve => setTimeout(resolve, 15000 + Math.random() * 10000));
          }
          
          lastError = error;
        }
      } catch (error) {
        console.error(`Outer login attempt ${i + 1} failed:`, error);
        lastError = error;
      }
    }
    
    throw lastError;
  }

  public async initialize(): Promise<void> {
    try {
      console.log('Initializing Twitter client...');
      if (this.isInitialized) {
        return;
      }

      this.scraper = new Scraper();
      
      const hasCookies = await this.loadCookies();
      if (!hasCookies) {
        await this.attemptLogin();
        if (this.scraper) {
          const cookies = await this.scraper.getCookies();
          if (cookies && cookies.length > 0) {
            await this.scraper.setCookies(cookies);
          }
        }
      }

      if (!this.scraper) {
        throw new Error('Scraper initialization failed');
      }

      const isLoggedIn = await this.scraper.isLoggedIn();
      if (!isLoggedIn) {
        throw new Error('Failed to verify Twitter login status');
      }

      this.streamHandler = new TwitterStreamHandler(this, this.aiService);
      await this.startStream();
      
      this.isInitialized = true;
      console.log('Twitter client initialized successfully', {
        username: this.username,
        isAuthenticated: true,
        streamActive: true
      });
    } catch (error) {
      console.error('Failed to initialize Twitter client:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        username: this.username
      });
      throw error;
    }
  }

  private async startStream(): Promise<void> {
    if (!this.streamHandler) {
      throw new Error('Stream handler not initialized');
    }
    await this.streamHandler.start();
  }

  private ensureInitialized(): void {
    if (!this.isInitialized || !this.scraper) {
      throw new Error('AgentTwitterClientService not initialized. Call initialize() first.');
    }
  }

  public async postTweet(content: string): Promise<{ success: boolean; error?: Error }> {
    try {
      this.ensureInitialized();
      if (!this.scraper) {
        throw new Error('Twitter client not initialized');
      }

      // Validate tweet length
      const MAX_TWEET_LENGTH = 280;
      if (!content) {
        throw new Error('Tweet content cannot be empty');
      }
      
      if (content.length > MAX_TWEET_LENGTH) {
        // Truncate with ellipsis if too long
        content = content.substring(0, MAX_TWEET_LENGTH - 3) + '...';
        console.warn('Tweet content truncated to fit length limit');
      }

      // Send tweet with validated content
      await this.scraper.sendTweet(content);
      return { success: true };
    } catch (error) {
      console.error('Error sending tweet:', error);
      return { success: false, error: error as Error };
    }
  }

  public async getProfile(username: string): Promise<any> {
    try {
      this.ensureInitialized();
      if (!this.scraper) {
        throw new Error('Twitter client not initialized');
      }
      const profile = await this.scraper.getProfile(username);
      return profile;
    } catch (error) {
      console.error('Error getting profile:', error);
      throw error;
    }
  }

  public async replyToTweet(tweetId: string, content: string): Promise<{ success: boolean; error?: Error }> {
    try {
      this.ensureInitialized();
      if (!this.scraper) {
        throw new Error('Twitter client not initialized');
      }
      // For replies, we'll construct the tweet with a mention
      // This is a workaround since direct reply functionality isn't available
      const tweet = await this.scraper.getTweet(tweetId);
      if (!tweet) {
        throw new Error('Could not fetch original tweet');
      }
      const replyContent = `@${tweet.username} ${content}`;
      await this.scraper.sendTweet(replyContent);
      return { success: true };
    } catch (error) {
      console.error('Error replying to tweet:', error);
      return { success: false, error: error as Error };
    }
  }

  public async likeTweet(tweetId: string): Promise<void> {
    this.ensureInitialized();
    if (!this.scraper) return;
    await this.scraper.likeTweet(tweetId);
  }

  public async retweet(tweetId: string): Promise<void> {
    this.ensureInitialized();
    if (!this.scraper) return;
    await this.scraper.retweet(tweetId);
  }

  public async cleanup(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    if (this.streamHandler) {
      await this.streamHandler.stop();
    }

    if (this.scraper) {
      await this.scraper.clearCookies();
      this.scraper = null;
    }

    this.isInitialized = false;
    this.isMonitoring = false;
  }
}
