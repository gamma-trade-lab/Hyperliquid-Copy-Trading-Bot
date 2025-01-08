import { AgentMemoryService } from './index.js';
import { Memory, MemorySearchOptions } from './types.js';

export class AgentMemoryIntegration {
  private memoryService: AgentMemoryService;

  constructor(memoryService: AgentMemoryService) {
    this.memoryService = memoryService;
  }

  async recordTweet(tweetContent: string, metadata: Record<string, any>): Promise<string> {
    return await this.memoryService.createMemory({
      content: tweetContent,
      category: 'tweet',
      timestamp: Date.now(),
      metadata
    });
  }

  async recordSentiment(content: string, sentiment: number): Promise<string> {
    return await this.memoryService.createMemory({
      content,
      category: 'sentiment',
      timestamp: Date.now(),
      metadata: { sentiment }
    });
  }

  async findSimilarTweets(content: string, options: MemorySearchOptions = {}): Promise<Memory[]> {
    return await this.memoryService.searchMemories({
      ...options,
      category: 'tweet'
    });
  }

  async getSentimentHistory(timeRange: { start: number; end: number }): Promise<Memory[]> {
    return await this.memoryService.getMemoriesByCategory('sentiment', timeRange);
  }
}
