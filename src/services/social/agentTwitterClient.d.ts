import { AIService } from '../ai/ai';

export declare class AgentTwitterClientService {
  constructor(
    username: string,
    password: string,
    email: string,
    aiService: AIService
  );

  initialize(): Promise<void>;
  sendTweet(content: string): Promise<void>;
  postTweet(content: string): Promise<void>;
  replyToTweet(tweetId: string, content: string, username: string): Promise<void>;
  likeTweet(tweetId: string): Promise<void>;
  retweet(tweetId: string): Promise<void>;
  getProfile(username: string): Promise<any>;
}
