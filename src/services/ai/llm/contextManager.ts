// src/services/ai/llm/contextManager.ts

import { EventEmitter } from 'events';

interface Context {
  id: string;
  type: ContextType;
  content: string;
  metadata: {
    source: string;
    timestamp: number;
    expiresAt?: number;
    priority: number;
  };
  embeddings?: number[];
  relations?: string[];
}

interface ContextWindow {
  id: string;
  contexts: Context[];
  size: number;
  maxSize: number;
  metadata: {
    createdAt: number;
    updatedAt: number;
    topic?: string;
  };
}

enum ContextType {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
  MEMORY = 'memory',
  MARKET = 'market'
}

export class ContextManager extends EventEmitter {
  private contexts: Map<string, Context>;
  private windows: Map<string, ContextWindow>;
  private readonly DEFAULT_WINDOW_SIZE = 4096;
  private readonly MAX_CONTEXTS = 1000;
  private readonly CLEANUP_INTERVAL = 3600000; // 1 hour

  constructor() {
    super();
    this.contexts = new Map();
    this.windows = new Map();
    this.startPeriodicCleanup();
  }

  public async addContext(context: Omit<Context, 'id'>): Promise<string> {
    try {
      const id = `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newContext: Context = {
        ...context,
        id,
        metadata: {
          ...context.metadata,
          timestamp: Date.now()
        }
      };

      // Generate embeddings if needed
      if (!newContext.embeddings) {
        newContext.embeddings = await this.generateEmbeddings(newContext.content);
      }

      this.contexts.set(id, newContext);
      this.emit('contextAdded', newContext);

      return id;
    } catch (error) {
      console.error('Error adding context:', error);
      throw error;
    }
  }

  public async createWindow(
    options: {
      contexts?: string[];
      maxSize?: number;
      topic?: string;
    } = {}
  ): Promise<string> {
    try {
      const id = `window-${Date.now()}`;
      const window: ContextWindow = {
        id,
        contexts: [],
        size: 0,
        maxSize: options.maxSize || this.DEFAULT_WINDOW_SIZE,
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          topic: options.topic
        }
      };

      if (options.contexts) {
        for (const contextId of options.contexts) {
          await this.addToWindow(window.id, contextId);
        }
      }

      this.windows.set(id, window);
      this.emit('windowCreated', window);

      return id;
    } catch (error) {
      console.error('Error creating context window:', error);
      throw error;
    }
  }

  public async addToWindow(
    windowId: string,
    contextId: string,
    position?: number
  ): Promise<void> {
    const window = this.windows.get(windowId);
    const context = this.contexts.get(contextId);

    if (!window || !context) {
      throw new Error('Window or context not found');
    }

    // Check size constraints
    const newSize = this.estimateTokenSize(context.content);
    if (window.size + newSize > window.maxSize) {
      await this.optimizeWindow(window);
      if (window.size + newSize > window.maxSize) {
        throw new Error('Context window size limit exceeded');
      }
    }

    // Add context to window
    if (typeof position === 'number') {
      window.contexts.splice(position, 0, context);
    } else {
      window.contexts.push(context);
    }

    window.size += newSize;
    window.metadata.updatedAt = Date.now();

    this.emit('contextAddedToWindow', { windowId, contextId });
  }

  private async optimizeWindow(window: ContextWindow): Promise<void> {
    const contexts = window.contexts;
    if (contexts.length === 0) return;

    // Calculate relevance scores
    const scores = await Promise.all(
      contexts.map(ctx => this.calculateRelevance(ctx, window))
    );

    // Sort by relevance and priority
    const sortedContexts = contexts
      .map((ctx, index) => ({
        context: ctx,
        score: scores[index]
      }))
      .sort((a, b) => {
        const priorityDiff = b.context.metadata.priority - a.context.metadata.priority;
        return priorityDiff !== 0 ? priorityDiff : b.score - a.score;
      });

    // Keep most relevant contexts within size limit
    let totalSize = 0;
    const keptContexts: Context[] = [];

    for (const { context } of sortedContexts) {
      const size = this.estimateTokenSize(context.content);
      if (totalSize + size <= window.maxSize) {
        keptContexts.push(context);
        totalSize += size;
      } else {
        break;
      }
    }

    window.contexts = keptContexts;
    window.size = totalSize;
    this.emit('windowOptimized', window);
  }

  private async calculateRelevance(
    context: Context,
    window: ContextWindow
  ): Promise<number> {
    let score = 0;

    // Time decay
    const age = Date.now() - context.metadata.timestamp;
    const timeScore = Math.exp(-age / (24 * 60 * 60 * 1000)); // 24 hours half-life
    score += timeScore * 0.3;

    // Semantic similarity if embeddings exist
    if (context.embeddings && window.metadata.topic) {
      const topicEmbedding = await this.generateEmbeddings(window.metadata.topic);
      const similarity = this.calculateCosineSimilarity(
        context.embeddings,
        topicEmbedding
      );
      score += similarity * 0.4;
    }

    // Relationship bonus
    if (context.relations) {
      const relatedContexts = window.contexts.filter(c =>
        context.relations!.includes(c.id)
      );
      score += (relatedContexts.length / window.contexts.length) * 0.3;
    }

    return score;
  }

  private async generateEmbeddings(text: string): Promise<number[]> {
    // Implement embedding generation
    // This would typically use a service like OpenAI's embeddings API
    return [];
  }

  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    return dotProduct / (magnitudeA * magnitudeB);
  }

  private estimateTokenSize(text: string): number {
    // Simple token estimation (approx 4 chars per token)
    return Math.ceil(text.length / 4);
  }

  private startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }

  private cleanup(): void {
    const now = Date.now();

    // Clean expired contexts
    for (const [id, context] of this.contexts) {
      if (
        context.metadata.expiresAt &&
        context.metadata.expiresAt < now
      ) {
        this.contexts.delete(id);
        this.emit('contextExpired', context);
      }
    }

    // Clean empty windows
    for (const [id, window] of this.windows) {
      if (window.contexts.length === 0) {
        this.windows.delete(id);
        this.emit('windowRemoved', window);
      }
    }

    // Maintain maximum context limit
    if (this.contexts.size > this.MAX_CONTEXTS) {
      const sortedContexts = Array.from(this.contexts.values())
        .sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);
      
      const toRemove = sortedContexts.slice(0, this.contexts.size - this.MAX_CONTEXTS);
      toRemove.forEach(context => {
        this.contexts.delete(context.id);
        this.emit('contextRemoved', context);
      });
    }
  }

  public getContext(contextId: string): Context | undefined {
    return this.contexts.get(contextId);
  }

  public getWindow(windowId: string): ContextWindow | undefined {
    return this.windows.get(windowId);
  }

  public async searchContexts(
    query: string,
    options: {
      type?: ContextType;
      maxResults?: number;
      minRelevance?: number;
    } = {}
  ): Promise<Array<{ context: Context; relevance: number }>> {
    const queryEmbedding = await this.generateEmbeddings(query);
    const results: Array<{ context: Context; relevance: number }> = [];

    for (const context of this.contexts.values()) {
      if (options.type && context.type !== options.type) continue;

      let relevance = 0;
      if (context.embeddings) {
        relevance = this.calculateCosineSimilarity(
          context.embeddings,
          queryEmbedding
        );
      }

      if (!options.minRelevance || relevance >= options.minRelevance) {
        results.push({ context, relevance });
      }
    }

    results.sort((a, b) => b.relevance - a.relevance);
    return options.maxResults ? results.slice(0, options.maxResults) : results;
  }
}