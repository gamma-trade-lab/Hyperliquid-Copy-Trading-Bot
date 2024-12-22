// src/types/twitter.d.ts
import { TweetV2 } from 'twitter-api-v2';

export interface TwitterStreamEvent {
  text: string;
  id: string;
  author_id?: string;
  referenced_tweets?: {
    type: string;
    id: string;
  }[];
}

export type StreamTweet = TweetV2 & TwitterStreamEvent;