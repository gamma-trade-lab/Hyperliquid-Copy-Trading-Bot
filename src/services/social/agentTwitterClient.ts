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
    private readonly username: string,
    private readonly password: string,
    private readonly email: string,
    private readonly aiService: AIService
  ) {}

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
          const delay = Math.min(5000 * Math.pow(2, i) + Math.random() * 5000, 30000);
          console.log(`Waiting ${Math.round(delay)}ms before attempt ${i + 1}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        await this.scraper.clearCookies();
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log(`Attempting login with username: ${this.username}`);
        
        // Set essential cookies for authentication
        await this.scraper.withCookie('att=1;');
        await this.scraper.withCookie('lang=en;');
        
        console.log('Setting up authentication with credentials:', {
          username: !!this.username,
          email: !!this.email,
          hasPassword: !!this.password
        });
        
        await this.scraper.login(
          this.username,
          this.password,
          this.email
        );

        await new Promise(resolve => setTimeout(resolve, 5000));

        let loginVerified = false;
        for (let verifyAttempt = 0; verifyAttempt < 3; verifyAttempt++) {
          const isLoggedIn = await this.scraper.isLoggedIn();
          if (isLoggedIn) {
            loginVerified = true;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (!loginVerified) {
          throw new Error('Login appeared successful but verification failed');
        }

        console.log('Login successful and verified');
        return;
      } catch (error) {
        console.warn(`Login attempt ${i + 1} failed:`, error);
        lastError = error;
        
        const errorObj = error as any;
        if (errorObj?.errors?.[0]?.code === 399) {
          console.log('Twitter ACID challenge detected. Details:', {
            code: errorObj?.errors?.[0]?.code,
            message: errorObj?.errors?.[0]?.message,
            timestamp: new Date().toISOString()
          });
          
          // Handle ACID challenge with longer delays
          const waitTime = 30000 + Math.random() * 30000;
          console.log(`Waiting ${Math.round(waitTime)}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          console.log('Clearing cookies and preparing fresh session...');
          await this.scraper.clearCookies();
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Set essential cookies
          await this.scraper.withCookie('att=1;');
          await this.scraper.withCookie('lang=en;');
        } else if (errorObj?.errors?.[0]?.code === 366) {
          console.log('Missing data error. Retrying with clean session...');
          await this.scraper.clearCookies();
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
    throw lastError;
  }

  public async initialize(): Promise<void> {
    try {
      console.log('Initializing Twitter client...');
      if (this.isInitialized) return;
      
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

      if (!this.scraper) throw new Error('Scraper initialization failed');
      const isLoggedIn = await this.scraper.isLoggedIn();
      if (!isLoggedIn) {
        throw new Error('Failed to verify Twitter login status');
      }


      // Initialize stream handler
      this.streamHandler = new TwitterStreamHandler(this, this.aiService);
      
      // Start the stream
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

  private ensureInitialized(): void {
    if (!this.isInitialized || !this.scraper) {
      throw new Error('AgentTwitterClientService not initialized. Call initialize() first.');
    }
  }

  public async sendTweet(content: string): Promise<{ success: boolean; error?: Error }> {
    try {
      this.ensureInitialized();
      if (this.scraper) {
        await this.scraper.sendTweet(content);
        console.log('Tweet sent successfully', { contentLength: content.length });
        return { success: true };
      }
      return { success: false, error: new Error('Scraper not initialized') };
    } catch (error) {
      console.error('Failed to send tweet:', error);
      return { success: false, error: error instanceof Error ? error : new Error('Unknown error') };
    }
  }

  // Alias for sendTweet to maintain compatibility with MarketTweetCron
  public async postTweet(content: string): Promise<{ success: boolean; error?: Error }> {
    return this.sendTweet(content);
  }

  public async replyToTweet(tweetId: string, content: string, username: string): Promise<{ success: boolean; error?: Error }> {
    try {
      this.ensureInitialized();
      if (this.scraper) {
        // Format the reply with the username mention
        const replyContent = username.startsWith('@') ? `${username} ${content}` : `@${username} ${content}`;
        await this.scraper.sendTweet(replyContent);
        console.log('Reply sent successfully');
        return { success: true };
      }
      return { success: false, error: new Error('Scraper not initialized') };
    } catch (error) {
      console.error('Failed to send reply:', error);
      return { success: false, error: error instanceof Error ? error : new Error('Unknown error') };
    }
  }

  public async likeTweet(tweetId: string): Promise<{ success: boolean; error?: Error }> {
    try {
      this.ensureInitialized();
      if (this.scraper) {
        await this.scraper.likeTweet(tweetId);
        console.log('Tweet liked successfully');
        return { success: true };
      }
      return { success: false, error: new Error('Scraper not initialized') };
    } catch (error) {
      console.error('Failed to like tweet:', error);
      return { success: false, error: error instanceof Error ? error : new Error('Unknown error') };
    }
  }

  public async retweet(tweetId: string): Promise<{ success: boolean; error?: Error }> {
    try {
      this.ensureInitialized();
      if (this.scraper) {
        await this.scraper.retweet(tweetId);
        console.log('Retweet sent successfully');
        return { success: true };
      }
      return { success: false, error: new Error('Scraper not initialized') };
    } catch (error) {
      console.error('Failed to retweet:', error);
      return { success: false, error: error instanceof Error ? error : new Error('Unknown error') };
    }
  }

  public async startStream(): Promise<void> {
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

  public async getProfile(username: string): Promise<{
    id: string;
    username: string;
    name?: string;
    followers_count?: number;
    following_count?: number;
  }> {
    this.ensureInitialized();
    try {
      if (this.scraper) {
        const profile: Profile = await this.scraper.getProfile(username);
        return {
          id: profile.userId?.toString() || '',
          username: profile.username || '',
          name: profile.name,
          followers_count: profile.followersCount,
          following_count: profile.friendsCount
        };
      }
      throw new Error('Scraper not initialized');
    } catch (error) {
      console.error('Failed to get profile:', error);
      throw new Error(`Failed to get profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
