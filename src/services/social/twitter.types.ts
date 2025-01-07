import { IAIService } from '../ai/types';

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

import { TwitterStreamEvent as BaseTwitterStreamEvent } from '../../types/twitter';
export { BaseTwitterStreamEvent as TwitterStreamEvent };
