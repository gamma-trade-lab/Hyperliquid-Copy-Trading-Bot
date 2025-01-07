// src/services/social/engagement/postQueue.ts

import { EventEmitter } from 'events';
import { Platform } from '../../../personality/traits/responsePatterns.js';
import { IAIService, ChatResponse } from '../../ai/types.js';
import { TwitterService } from '../twitter.js';

interface PostQueueConfig {
  aiService: IAIService;
  twitterService: TwitterService;
}

interface QueuedPost {
  id: string;
  content: string;
  platform: Platform;
  priority: number;
  scheduledTime: number;
  retryCount: number;
  metadata: {
    type: string;
    category: string;
    tags: string[];
    campaign?: string;
  };
  status: PostStatus;
  createdAt: number;
}

enum PostStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export class PostQueue extends EventEmitter {
  private queue: Map<string, QueuedPost>;
  private processingQueue: Set<string>;
  private readonly MAX_RETRY_COUNT = 3;
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly PROCESSING_INTERVAL = 1000; // 1 second

  private aiService: IAIService;
  private twitterService: TwitterService;

  constructor(config: PostQueueConfig) {
    super();
    this.queue = new Map();
    this.processingQueue = new Set();
    this.aiService = config.aiService;
    this.twitterService = config.twitterService;
    this.startProcessingLoop();
  }

  public async addToQueue(post: Omit<QueuedPost, 'id' | 'status' | 'createdAt' | 'retryCount'>): Promise<string> {
    if (this.queue.size >= this.MAX_QUEUE_SIZE) {
      throw new Error('Queue is at maximum capacity');
    }

    const id = `post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const queuedPost: QueuedPost = {
      ...post,
      id,
      status: PostStatus.PENDING,
      createdAt: Date.now(),
      retryCount: 0
    };

    this.queue.set(id, queuedPost);
    this.emit('postAdded', queuedPost);

    // Sort queue by priority and scheduled time
    this.sortQueue();

    return id;
  }

  public async removeFromQueue(postId: string): Promise<void> {
    const post = this.queue.get(postId);
    if (!post) {
      throw new Error('Post not found in queue');
    }

    this.queue.delete(postId);
    this.emit('postRemoved', post);
  }

  public async updatePost(
    postId: string,
    updates: Partial<Omit<QueuedPost, 'id' | 'createdAt'>>
  ): Promise<QueuedPost> {
    const post = this.queue.get(postId);
    if (!post) {
      throw new Error('Post not found in queue');
    }

    const updatedPost = {
      ...post,
      ...updates
    };

    this.queue.set(postId, updatedPost);
    this.emit('postUpdated', updatedPost);

    // Re-sort queue if priority or scheduled time changed
    if (updates.priority !== undefined || updates.scheduledTime !== undefined) {
      this.sortQueue();
    }

    return updatedPost;
  }

  public getQueueStatus(): {
    total: number;
    pending: number;
    scheduled: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    const posts = Array.from(this.queue.values());
    return {
      total: posts.length,
      pending: posts.filter(p => p.status === PostStatus.PENDING).length,
      scheduled: posts.filter(p => p.status === PostStatus.SCHEDULED).length,
      processing: posts.filter(p => p.status === PostStatus.PROCESSING).length,
      completed: posts.filter(p => p.status === PostStatus.COMPLETED).length,
      failed: posts.filter(p => p.status === PostStatus.FAILED).length
    };
  }

  public getPostsByStatus(status: PostStatus): QueuedPost[] {
    return Array.from(this.queue.values())
      .filter(post => post.status === status)
      .sort((a, b) => b.priority - a.priority || a.scheduledTime - b.scheduledTime);
  }

  public getPendingPosts(): QueuedPost[] {
    return this.getPostsByStatus(PostStatus.PENDING);
  }

  public getScheduledPosts(): QueuedPost[] {
    return this.getPostsByStatus(PostStatus.SCHEDULED);
  }

  public getFailedPosts(): QueuedPost[] {
    return this.getPostsByStatus(PostStatus.FAILED);
  }

  private sortQueue(): void {
    const sortedEntries = Array.from(this.queue.entries())
      .sort(([, a], [, b]) => {
        // Sort by priority (high to low) and then by scheduled time (early to late)
        return b.priority - a.priority || a.scheduledTime - b.scheduledTime;
      });

    this.queue = new Map(sortedEntries);
  }

  private startProcessingLoop(): void {
    setInterval(() => {
      this.processQueue();
    }, this.PROCESSING_INTERVAL);
  }

  private async processQueue(): Promise<void> {
    const now = Date.now();
    const readyPosts = Array.from(this.queue.values())
      .filter(post => 
        post.status === PostStatus.PENDING &&
        post.scheduledTime <= now &&
        !this.processingQueue.has(post.id)
      )
      .sort((a, b) => b.priority - a.priority);

    for (const post of readyPosts) {
      await this.processPost(post);
    }
  }

  private async processPost(post: QueuedPost): Promise<void> {
    if (this.processingQueue.has(post.id)) {
      return; // Already processing
    }

    this.processingQueue.add(post.id);
    post.status = PostStatus.PROCESSING;
    this.emit('postProcessing', post);

    try {
      try {
        // Generate content if needed
        let content = post.content;
        if (!content && post.platform === 'twitter') {
          const prompt = `Generate a fun, tweet-ready message about ${post.metadata.category}` + 
            (post.metadata.tags.length ? ` including tags: ${post.metadata.tags.join(', ')}` : '') +
            (post.metadata.campaign ? ` for campaign: ${post.metadata.campaign}` : '');

          content = await this.aiService.generateResponse({
            content: prompt,
            author: 'system',
            platform: 'twitter',
            channel: post.id
          });
        }

        if (!content) {
          throw new Error('No content available for post');
        }

        // Post to appropriate platform
        switch (post.platform) {
          case 'twitter':
            await this.twitterService.tweet(content);
            break;
          default:
            throw new Error(`Unsupported platform: ${post.platform}`);
        }
      } catch (error) {
        console.error(`Error processing post ${post.id}:`, error);
        throw error; // Re-throw to be handled by the outer try-catch
      }

      post.status = PostStatus.COMPLETED;
      this.emit('postCompleted', post);
    } catch (error) {
      console.error(`Error processing post ${post.id}:`, error);
      
      if (post.retryCount < this.MAX_RETRY_COUNT) {
        post.retryCount++;
        post.status = PostStatus.PENDING;
        post.scheduledTime = Date.now() + (post.retryCount * 60000); // Retry after 1, 2, 3 minutes
        this.emit('postRetrying', post);
      } else {
        post.status = PostStatus.FAILED;
        this.emit('postFailed', post, error);
      }
    } finally {
      this.processingQueue.delete(post.id);
    }
  }

  public cleanup(): void {
    // Remove completed and failed posts older than 24 hours
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    
    for (const [id, post] of this.queue.entries()) {
      if (
        (post.status === PostStatus.COMPLETED || post.status === PostStatus.FAILED) &&
        post.createdAt < cutoff
      ) {
        this.queue.delete(id);
      }
    }
  }
}
