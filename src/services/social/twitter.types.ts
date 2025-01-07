import { IAIService } from '../ai/types.js';

export interface TwitterConfig {
  credentials: {
    username: string;
    password: string;
    email: string;
  };
  aiService?: IAIService;
}

export interface TweetOptions {
  replyToTweet?: string;
  quoteTweetId?: string;
}

import { TwitterStreamEvent as BaseTwitterStreamEvent } from '../../types/twitter.js';
export { BaseTwitterStreamEvent as TwitterStreamEvent };
