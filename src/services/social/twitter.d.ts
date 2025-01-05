import { AIService } from '../ai/types';

export interface TwitterConfig {
  credentials: {
    username: string;
    password: string;
    email: string;
  };
  aiService: AIService;
}

export interface TweetOptions {
  replyToTweet?: string;
  quoteTweetId?: string;
}

export interface TwitterStreamEvent {
  id: string;
  text: string;
  created_at: string;
}
