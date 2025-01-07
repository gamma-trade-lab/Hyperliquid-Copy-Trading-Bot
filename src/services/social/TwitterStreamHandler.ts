import { EventEmitter } from 'events';
import { SentimentAnalyzer } from './analytics/sentiment.js';
import { AgentTwitterClientService } from './agentTwitterClient.js';
import { AIService } from '../ai/ai.js';
import { TwitterStreamEvent } from '../../types/twitter.js';

interface StreamConfig {
  replyThreshold: number;
  maxRepliesPerMinute: number;
}

export class TwitterStreamHandler extends EventEmitter {
  private sentimentAnalyzer: SentimentAnalyzer;
  private twitterClient: AgentTwitterClientService;
  private aiService: AIService;
  private isStreaming = false;
  private replyCount: number = 0;
  private lastReplyReset: number = Date.now();
  private resetInterval?: NodeJS.Timeout;

  private config: StreamConfig = {
    replyThreshold: 0.5,  // Adjusted threshold as per requirements
    maxRepliesPerMinute: 5
  };

  constructor(
    twitterClient: AgentTwitterClientService,
    aiService: AIService
  ) {
    super();
    this.twitterClient = twitterClient;
    this.aiService = aiService;
    this.sentimentAnalyzer = new SentimentAnalyzer(aiService);

    // Reset reply counter every minute
    this.resetInterval = setInterval(() => {
      this.replyCount = 0;
      this.lastReplyReset = Date.now();
    }, 60 * 1000);
  }

  public async initialize(): Promise<void> {
    try {
      // Start the Twitter stream
      await this.start();
      this.emit('streamInitialized');
    } catch (error) {
      console.error('Failed to initialize Twitter stream:', error);
      this.emit('streamError', error);
      throw error;
    }
  }

  public async start(): Promise<void> {
    if (this.isStreaming) return;
    
    console.log('Starting Twitter stream handler...');
    this.isStreaming = true;
  }

  public async stop(): Promise<void> {
    if (!this.isStreaming) return;
    
    console.log('Stopping Twitter stream handler...');
    this.isStreaming = false;
    
    if (this.resetInterval) {
      clearInterval(this.resetInterval);
      this.resetInterval = undefined;
    }
  }

  public async handleTweetEvent(event: TwitterStreamEvent): Promise<void> {
    try {
      // Skip if we've hit rate limit
      if (!this.canReply()) {
        console.log('Rate limit reached, skipping tweet');
        return;
      }

      // Analyze sentiment
      const sentiment = await this.sentimentAnalyzer.analyzeSentiment(
        event.text,
        {
          tweetId: event.id,
          authorId: event.author_id,
          timestamp: Date.now() // Use current timestamp instead of created_at
        }
      );

      // Only reply to tweets with positive sentiment above threshold
      if (sentiment.scores.score >= this.config.replyThreshold) {
        const response = await this.generateResponse(event, sentiment);
        
        if (response) {
          await this.twitterClient.replyToTweet(
            event.id,
            response
          );
          this.replyCount++;
          
          this.emit('reply', {
            tweetId: event.id,
            response,
            sentiment: sentiment.scores.score
          });
        }
      }
    } catch (error) {
      console.error('Error handling tweet event:', error);
      this.emit('error', error);
    }
  }

  private async generateResponse(
    event: TwitterStreamEvent,
    sentiment: any
  ): Promise<string> {
    try {
      const response = await this.aiService.generateResponse({
        content: event.text,
        author: event.author?.username || 'unknown',
        channel: 'twitter_stream',
        platform: 'twitter'
      });

      return this.formatResponse(response);
    } catch (error) {
      console.error('Error generating response:', error);
      return '';
    }
  }

  private formatResponse(response: string): string {
    // Ensure response fits Twitter's character limit
    if (response.length > 280) {
      response = response.substring(0, 277) + '...';
    }
    
    // Clean up any markdown or special characters
    response = response.replace(/[*_~`]/g, '');
    
    return response;
  }

  private canReply(): boolean {
    const now = Date.now();
    
    // Reset counter if minute has passed
    if (now - this.lastReplyReset >= 60 * 1000) {
      this.replyCount = 0;
      this.lastReplyReset = now;
    }
    
    return this.replyCount < this.config.maxRepliesPerMinute;
  }

  public async cleanup(): Promise<void> {
    try {
      // Clear the reset interval
      if (this.resetInterval) {
        clearInterval(this.resetInterval);
        this.resetInterval = undefined;
      }

      // Stop the Twitter stream if it's running
      this.isStreaming = false;

      // Reset counters
      this.replyCount = 0;
      this.lastReplyReset = Date.now();

      // Remove all listeners
      this.removeAllListeners();
    } catch (error) {
      console.error('Error during TwitterStreamHandler cleanup:', error);
      throw error;
    }
  }
}
