// src/types/twitter.d.ts
import { TweetV2 } from 'twitter-api-v2';

export interface TwitterAuthor {
  id: string;
  username: string;
  name?: string;
}

export interface TwitterStreamEvent {
  text: string;
  id: string;
  author_id?: string;
  author?: TwitterAuthor;
  created_at: string;
  referenced_tweets?: {
    type: string;
    id: string;
  }[];
}

export type StreamTweet = TweetV2 & TwitterStreamEvent;
