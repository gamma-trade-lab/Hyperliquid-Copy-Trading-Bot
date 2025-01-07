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

import { Scraper, Tweet } from 'agent-twitter-client';
import { IAIService } from '../ai/types';
import { MarketAction } from '../../config/constants';
import { MarketData } from '../../types/market';

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
  private scraper: Scraper;
  private aiService: IAIService;
  private isInitialized: boolean = false;
  private credentials?: TwitterConfig['credentials'];

  constructor(config: TwitterConfig) {
    this.scraper = new Scraper();
    this.aiService = config.aiService;
    this.credentials = config.credentials;
  }

  /**
   * Attempts to load existing session cookies
   * Used to restore previous sessions and avoid frequent logins
   * 
   * @returns Promise resolving to true if valid cookies were loaded
   */
  private async loadCookies(): Promise<boolean> {
    try {
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

    let lastError: unknown;
    for (let i = 0; i < retries; i++) {
      try {
        // Add initial delay to avoid rate limiting
        if (i > 0) {
          const delay = Math.min(5000 * Math.pow(2, i) + Math.random() * 5000, 30000);
          console.log(`Waiting ${Math.round(delay)}ms before attempt ${i + 1}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Clear cookies and wait before attempting login
        await this.scraper.clearCookies();
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log(`Attempting login with username: ${this.credentials.username}`);
        
        // Set proper User-Agent to mimic mobile browser
        const userAgent = 'Mozilla/5.0 (Linux; Android 11; Nokia G20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.88 Mobile Safari/537.36';
        
        // Configure scraper with proper headers
        await this.scraper.withCookie('att=1;');
        await this.scraper.withCookie('lang=en;');
        
        // Attempt login with proper configuration
        await this.scraper.login(
          this.credentials.username,
          this.credentials.password,
          this.credentials.email
        );

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

      const hasCookies = await this.loadCookies();
      if (!hasCookies) {
        await this.attemptLogin();
        // Cache cookies for future use
        const cookies = await this.scraper.getCookies();
        if (cookies && cookies.length > 0) {
          await this.scraper.setCookies(cookies);
        }
      }

      const isLoggedIn = await this.scraper.isLoggedIn();
      if (!isLoggedIn) {
        throw new Error('Failed to verify Twitter login status');
      }

      console.log(`Twitter bot initialized as @${this.credentials?.username}`);
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

      // Validate tweet content
      const MAX_TWEET_LENGTH = 280;
      if (!content) {
        return { success: false, error: new Error('Tweet content cannot be empty') };
      }

      // Handle tweet length
      if (content.length > MAX_TWEET_LENGTH) {
        if (options.truncateIfNeeded) {
          content = content.substring(0, MAX_TWEET_LENGTH - 3) + '...';
          console.warn('Tweet content truncated to fit length limit');
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
      console.error('Error sending tweet:', error);
      return { success: false, error: error as Error };
    }
  }

  async reply(tweetId: string, _content: string): Promise<string> {
    try {
      if (!this.isInitialized) {
        throw new Error('Twitter service not initialized');
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
      console.error('Error replying to tweet:', error);
      throw error;
    }
  }

  async retweet(tweetId: string): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('Twitter service not initialized');
      }

      await this.scraper.retweet(tweetId);
    } catch (error) {
      console.error('Error retweeting:', error);
      throw error;
    }
  }

  async like(tweetId: string): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('Twitter service not initialized');
      }

      await this.scraper.likeTweet(tweetId);
    } catch (error) {
      console.error('Error liking tweet:', error);
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
      console.error('Error publishing market update:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.isInitialized) {
        await this.scraper.logout();
        this.isInitialized = false;
      }
      console.log('Twitter service cleaned up');
    } catch (error) {
      console.error('Error during cleanup:', error);
      throw error;
    }
  }
}
