declare module 'agent-twitter-client' {
  export interface Profile {
    id: string;
    name: string;
    username: string;
    bio?: string;
    location?: string;
    url?: string;
    protected: boolean;
    verified: boolean;
    followersCount: number;
    followingCount: number;
    tweetsCount: number;
    listedCount: number;
    createdAt: Date;
    profileImageUrl?: string;
  }

  export interface Tweet {
    id: string;
    text: string;
    username: string;
    createdAt: Date;
    authorId: string;
    conversationId: string;
    inReplyToUserId?: string;
    referencedTweets?: Array<{
      type: 'retweeted' | 'quoted' | 'replied_to';
      id: string;
    }>;
    attachments?: {
      mediaKeys?: string[];
      pollIds?: string[];
    };
    geo?: {
      placeId: string;
      coordinates?: {
        type: string;
        coordinates: [number, number];
      };
    };
    metrics?: {
      retweets: number;
      replies: number;
      likes: number;
      quotes: number;
    };
  }

  export interface SearchMode {
    LATEST: 'Latest';
    TOP: 'Top';
    PHOTOS: 'Photos';
    VIDEOS: 'Videos';
  }

  export class Scraper {
    constructor(options?: { credentials?: any });
    getProfile(username: string): Promise<Profile>;
    getTweets(query: string, mode?: keyof SearchMode): Promise<Tweet[]>;
    getUserTweets(userId: string, count?: number): Promise<Tweet[]>;
    search(query: string, mode?: keyof SearchMode): Promise<Tweet[]>;
    getTweet(tweetId: string): Promise<Tweet>;
    sendTweet(content: string, replyToTweetId?: string): Promise<unknown>;
    sendQuoteTweet(content: string, quoteTweetId: string): Promise<void>;
    likeTweet(tweetId: string): Promise<void>;
    retweet(tweetId: string): Promise<void>;
    deleteTweet(tweetId: string): Promise<void>;
    login(credentials: { username: string; password: string }): Promise<void>;
    isLoggedIn(): Promise<boolean>;
    getCookies(): Promise<string[]>;
    setCookies(cookies: string[]): Promise<void>;
    clearCookies(): Promise<void>;
    withCookie(cookie: string): Promise<void>;
    logout(): Promise<void>;
  }
}
