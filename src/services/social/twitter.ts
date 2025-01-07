/**
 * Twitter Service Integration
 * 
 * This module provides Twitter interaction capabilities using agent-twitter-client for web scraping.
 * It implements a robust authentication system with retry logic and session management.
 * 
 * Key Features:
 * - Cookie-based authentication with automatic session management
 * - Exponential backoff retry mechanism for login attempts
 * - Handles Twitter's anti-automation challenges
 * - Supports posting, replying, retweeting, and liking tweets
 * 
 * @module TwitterService
 */

import { IAIService } from '../ai/types.js';
import { MarketAction } from '../../config/constants.js';
import { MarketData } from '../../types/market.js';
import { Logger } from '../../utils/logger.js';

// Define Scraper interface to match our needs
interface Scraper {
  initialize(): Promise<void>;
  login(credentials: { username: string; password: string }): Promise<void>;
  isLoggedIn(): Promise<boolean>;
  sendTweet(content: string, replyTo?: string): Promise<unknown>;
  sendQuoteTweet(content: string, quoteTweetId: string): Promise<unknown>;
  getTweet(tweetId: string): Promise<Tweet>;
  retweet(tweetId: string): Promise<void>;
  likeTweet(tweetId: string): Promise<void>;
  deleteTweet(tweetId: string): Promise<void>;
  logout(): Promise<void>;
  getCookies(): Promise<any[]>;
  setCookies(cookies: any[]): Promise<void>;
  clearCookies(): Promise<void>;
  withCookie(cookie: string): Promise<void>;
}

// Define types that would normally come from agent-twitter-client
interface Tweet {
  id: string;
  text: string;
  username?: string;
}

export interface TwitterConfig {
  credentials: {
    username: string;
    password: string;
    email: string;
  };
  aiService?: IAIService;
}

interface TweetOptions {
  replyToTweet?: string;
  quoteTweetId?: string;
  truncateIfNeeded?: boolean;
}

export class TwitterService {
  private scraper?: Scraper;
  private aiService: IAIService;
  private isInitialized: boolean = false;
  private credentials?: TwitterConfig['credentials'];
  private logger: Logger;

  constructor(config: TwitterConfig) {
    if (!config.aiService) {
      throw new Error('AI service is required for Twitter service');
    }
    this.aiService = config.aiService;
    this.credentials = config.credentials;
    this.logger = new Logger('TwitterService');
  }

  private async initializeScraper(): Promise<boolean> {
    try {
      const { Scraper } = await import('agent-twitter-client');
      const scraper = new Scraper() as unknown as Scraper;
      // Initialize scraper with required methods
      await scraper.initialize();
      this.scraper = scraper;
      return true;
    } catch (error) {
      this.logger.warn('Twitter client not available - running in mock mode');
      return false;
    }
  }

  /**
   * Attempts to load existing session cookies
   * Used to restore previous sessions and avoid frequent logins
   * 
   * @returns Promise resolving to true if valid cookies were loaded
   */
  private async loadCookies(): Promise<boolean> {
    try {
      if (!this.scraper) {
        return false;
      }
      const cookies = await this.scraper.getCookies();
      if (cookies && cookies.length > 0) {
        await this.scraper.setCookies(cookies);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.warn('Failed to load cookies:', error);
      return false;
    }
  }

  /**
   * Attempts to log in to Twitter with retry mechanism
   * Uses exponential backoff and handles various Twitter security challenges
   * 
   * @param retries - Maximum number of login attempts (default: 5)
   * @throws Error if login fails after all retries
   */
  private async attemptLogin(retries = 5): Promise<void> {
    if (!this.credentials) {
      throw new Error('Twitter credentials not configured');
    }

    if (!this.scraper) {
      throw new Error('Twitter client not initialized');
    }

    let lastError: unknown;
    for (let i = 0; i < retries; i++) {
      try {
        // Add initial delay to avoid rate limiting
        if (i > 0) {
          const delay = Math.min(5000 * Math.pow(2, i) + Math.random() * 5000, 30000);
          this.logger.info(`Waiting ${Math.round(delay)}ms before attempt ${i + 1}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Clear cookies and wait before attempting login
        await this.scraper.clearCookies();
        await new Promise(resolve => setTimeout(resolve, 2000));

        this.logger.info(`Attempting login with username: ${this.credentials.username}`);
        
        // Set proper User-Agent to mimic mobile browser
        const userAgent = 'Mozilla/5.0 (Linux; Android 11; Nokia G20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.88 Mobile Safari/537.36';
        
        // Configure scraper with proper headers
        await this.scraper.withCookie('att=1;');
        await this.scraper.withCookie('lang=en;');
        
        // Attempt login with proper configuration
        await this.scraper.login({
          username: this.credentials.username,
          password: this.credentials.password
        });

        // Add delay after login attempt to allow session establishment
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Verify login success with retries
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
        
        // Handle specific error codes
        const errorObj = error as any;
        if (errorObj?.errors?.[0]?.code === 399) {
          console.error('Twitter anti-automation check triggered (ACID challenge). Waiting longer...');
          // Add longer delay for anti-automation
          await new Promise(resolve => setTimeout(resolve, 15000 + Math.random() * 15000));
          // Clear cookies and reset session state
          await this.scraper.clearCookies();
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else if (errorObj?.errors?.[0]?.code === 366) {
          console.error('Missing data error. Retrying with clean session...');
          await this.scraper.clearCookies();
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
    throw lastError;
  }

  /**
   * Initializes the Twitter service
   * Handles authentication and session setup
   * 
   * 1. Attempts to load existing cookies
   * 2. If no valid cookies, performs fresh login
   * 3. Verifies login status
   * 
   * @throws Error if initialization fails
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      this.logger.info('Initializing Twitter service...');
      
      if (!this.credentials?.username || !this.credentials?.password) {
        throw new Error('Twitter credentials not properly configured');
      }
      
      const hasTwitterClient = await this.initializeScraper();
      if (!hasTwitterClient) {
        this.logger.info('Running in mock mode - Twitter functionality will be simulated');
        this.isInitialized = true;
        return;
      }
      
      this.logger.info(`Attempting to initialize Twitter service for @${this.credentials.username}`);

      const hasCookies = await this.loadCookies();
      if (!hasCookies) {
        this.logger.info('No valid session found, performing fresh login...');
        await this.attemptLogin();
        // Cache cookies for future use
        const cookies = await this.scraper?.getCookies();
        if (cookies && cookies.length > 0) {
          await this.scraper?.setCookies(cookies);
          this.logger.info('Session cookies cached successfully');
        }
      }

      const isLoggedIn = await this.scraper?.isLoggedIn();
      if (!isLoggedIn) {
        throw new Error('Failed to verify Twitter login status');
      }

      // Verify posting capability with a test tweet
      this.logger.info('Verifying tweet posting capability...');
      const testTweet = await this.tweet('Initializing system... [Test tweet - will be deleted]', { truncateIfNeeded: true });
      if (testTweet.success && testTweet.tweetId) {
        await this.scraper?.deleteTweet(testTweet.tweetId);
        this.logger.info('Tweet posting capability verified successfully');
      }

      this.logger.info(`Twitter service initialized successfully as @${this.credentials.username}`);
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Twitter service:', error);
      throw error;
    }
  }

  private getTweetId(response: unknown): string {
    if (typeof response === 'object' && response !== null) {
      // Try different possible response structures
      const resp = response as Record<string, unknown>;
      return String(
        resp.tweet_id || 
        resp.id || 
        (resp.data && typeof resp.data === 'object' ? (resp.data as Record<string, unknown>).id : '') ||
        ''
      );
    }
    return '';
  }

  async tweet(content: string, options: TweetOptions = {}): Promise<{ success: boolean; error?: Error; tweetId?: string }> {
    try {
      if (!this.isInitialized) {
        return { success: false, error: new Error('Twitter service not initialized') };
      }

      if (!this.scraper) {
        return { success: false, error: new Error('Twitter client not available') };
      }

      // Validate tweet content
      const MAX_TWEET_LENGTH = 280;
      if (!content) {
        return { success: false, error: new Error('Tweet content cannot be empty') };
      }

      // Handle tweet length
      if (content.length > MAX_TWEET_LENGTH) {
        if (options.truncateIfNeeded) {
          content = content.substring(0, MAX_TWEET_LENGTH - 3) + '...';
          this.logger.warn('Tweet content truncated to fit length limit');
        } else {
          return { 
            success: false, 
            error: new Error(`Tweet content exceeds maximum length of ${MAX_TWEET_LENGTH} characters`) 
          };
        }
      }

      let result: unknown;
      if (options.replyToTweet) {
        result = await this.scraper.sendTweet(content, options.replyToTweet);
      } else if (options.quoteTweetId) {
        result = await this.scraper.sendQuoteTweet(content, options.quoteTweetId);
      } else {
        result = await this.scraper.sendTweet(content);
      }

      const tweetId = this.getTweetId(result);
      if (!tweetId) {
        return { success: false, error: new Error('Failed to get tweet ID from response') };
      }
      return { success: true, tweetId };
    } catch (error) {
      this.logger.error('Error sending tweet:', error);
      return { success: false, error: error as Error };
    }
  }

  async reply(tweetId: string, _content: string): Promise<string> {
    try {
      if (!this.isInitialized) {
        throw new Error('Twitter service not initialized');
      }

      if (!this.scraper) {
        throw new Error('Twitter client not available');
      }

      const tweet = await this.scraper.getTweet(tweetId) as Tweet;
      const tweetText = tweet?.text || '';
      const tweetUsername = tweet?.username || 'unknown';

      const response = await this.aiService.generateResponse({
        content: tweetText,
        author: tweetUsername,
        platform: 'twitter',
        channel: tweetId
      });

      const result = await this.scraper.sendTweet(response, tweetId);
      const responseTweetId = this.getTweetId(result);
      if (!responseTweetId) {
        throw new Error('Failed to get tweet ID from response');
      }
      return responseTweetId;
    } catch (error) {
      this.logger.error('Error replying to tweet:', error);
      throw error;
    }
  }

  async retweet(tweetId: string): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('Twitter service not initialized');
      }

      if (!this.scraper) {
        throw new Error('Twitter client not available');
      }

      await this.scraper.retweet(tweetId);
    } catch (error) {
      this.logger.error('Error retweeting:', error);
      throw error;
    }
  }

  async like(tweetId: string): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('Twitter service not initialized');
      }

      if (!this.scraper) {
        throw new Error('Twitter client not available');
      }

      await this.scraper.likeTweet(tweetId);
    } catch (error) {
      this.logger.error('Error liking tweet:', error);
      throw error;
    }
  }

  async publishMarketUpdate(action: MarketAction, data: MarketData): Promise<string> {
    try {
      if (!this.isInitialized) {
        throw new Error('Twitter service not initialized');
      }

      const content = await this.aiService.generateMarketUpdate({
        action,
        data,
        platform: 'twitter'
      });

      const result = await this.tweet(content);
      if (!result.success || !result.tweetId) {
        throw result.error || new Error('Failed to publish market update');
      }
      return result.tweetId;
    } catch (error) {
      this.logger.error('Error publishing market update:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.isInitialized && this.scraper) {
        await this.scraper.logout();
        this.isInitialized = false;
      }
      this.logger.info('Twitter service cleaned up');
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
      throw error;
    }
  }
}
