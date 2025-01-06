import { IAIService } from '../ai/types';
import type { Scraper, Profile } from 'agent-twitter-client';

export interface TwitterResponse {
  success: boolean;
  error?: Error;
}

export interface TwitterProfile extends Partial<Profile> {
  id: string;
  username: string;
  name?: string;
  followers_count?: number;
  following_count?: number;
}

export interface TwitterCookies {
  name: string;
  value: string;
  domain: string;
  path: string;
}

export declare class AgentTwitterClientService {
  private scraper: Scraper;
  private isInitialized: boolean;
  private cookies?: TwitterCookies[];

  constructor(
    username: string,
    password: string,
    email: string,
    aiService: IAIService
  );

  initialize(): Promise<void>;
  sendTweet(content: string): Promise<TwitterResponse>;
  postTweet(content: string): Promise<TwitterResponse>;
  replyToTweet(tweetId: string, content: string, username: string): Promise<TwitterResponse>;
  likeTweet(tweetId: string): Promise<TwitterResponse>;
  retweet(tweetId: string): Promise<TwitterResponse>;
  getProfile(username: string): Promise<TwitterProfile>;
  getCookies(): Promise<TwitterCookies[]>;
  setCookies(cookies: TwitterCookies[]): Promise<void>;
  startStream(): Promise<void>;
  stopStream(): Promise<void>;
}
