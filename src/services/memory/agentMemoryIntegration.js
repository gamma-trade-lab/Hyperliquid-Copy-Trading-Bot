export class AgentMemoryIntegration {
    memoryService;
    constructor(memoryService) {
        this.memoryService = memoryService;
    }
    async recordTweet(tweetContent, metadata) {
        return await this.memoryService.createMemory({
            content: tweetContent,
            category: 'tweet',
            timestamp: Date.now(),
            metadata
        });
    }
    async recordSentiment(content, sentiment) {
        return await this.memoryService.createMemory({
            content,
            category: 'sentiment',
            timestamp: Date.now(),
            metadata: { sentiment }
        });
    }
    async findSimilarTweets(content, options = {}) {
        return await this.memoryService.searchMemories({
            ...options,
            category: 'tweet'
        });
    }
    async getSentimentHistory(timeRange) {
        return await this.memoryService.getMemoriesByCategory('sentiment', timeRange);
    }
}
