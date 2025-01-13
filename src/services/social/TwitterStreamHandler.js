import { EventEmitter } from 'events';
import { SentimentAnalyzer } from './analytics/sentiment.js';
export class TwitterStreamHandler extends EventEmitter {
    sentimentAnalyzer;
    twitterClient;
    aiService;
    isStreaming = false;
    replyCount = 0;
    lastReplyReset = Date.now();
    resetInterval;
    config = {
        replyThreshold: 0.5, // Adjusted threshold as per requirements
        maxRepliesPerMinute: 5
    };
    constructor(twitterClient, aiService) {
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
    async initialize() {
        try {
            // Start the Twitter stream
            await this.start();
            this.emit('streamInitialized');
        }
        catch (error) {
            console.error('Failed to initialize Twitter stream:', error);
            this.emit('streamError', error);
            throw error;
        }
    }
    async start() {
        if (this.isStreaming)
            return;
        console.log('Starting Twitter stream handler...');
        this.isStreaming = true;
    }
    async stop() {
        if (!this.isStreaming)
            return;
        console.log('Stopping Twitter stream handler...');
        this.isStreaming = false;
        if (this.resetInterval) {
            clearInterval(this.resetInterval);
            this.resetInterval = undefined;
        }
    }
    async handleTweetEvent(event) {
        try {
            // Skip if we've hit rate limit
            if (!this.canReply()) {
                console.log('Rate limit reached, skipping tweet');
                return;
            }
            // Analyze sentiment
            const sentiment = await this.sentimentAnalyzer.analyzeSentiment(event.text, {
                tweetId: event.id,
                authorId: event.author_id,
                timestamp: Date.now() // Use current timestamp instead of created_at
            });
            // Only reply to tweets with positive sentiment above threshold
            if (sentiment.scores.score >= this.config.replyThreshold) {
                const response = await this.generateResponse(event, sentiment);
                if (response) {
                    await this.twitterClient.replyToTweet(event.id, response);
                    this.replyCount++;
                    this.emit('reply', {
                        tweetId: event.id,
                        response,
                        sentiment: sentiment.scores.score
                    });
                }
            }
        }
        catch (error) {
            console.error('Error handling tweet event:', error);
            this.emit('error', error);
        }
    }
    async generateResponse(event, sentiment) {
        try {
            const response = await this.aiService.generateResponse({
                content: event.text,
                author: event.author?.username || 'unknown',
                channel: 'twitter_stream',
                platform: 'twitter'
            });
            return this.formatResponse(response);
        }
        catch (error) {
            console.error('Error generating response:', error);
            return '';
        }
    }
    formatResponse(response) {
        // Ensure response fits Twitter's character limit
        if (response.length > 280) {
            response = response.substring(0, 277) + '...';
        }
        // Clean up any markdown or special characters
        response = response.replace(/[*_~`]/g, '');
        return response;
    }
    canReply() {
        const now = Date.now();
        // Reset counter if minute has passed
        if (now - this.lastReplyReset >= 60 * 1000) {
            this.replyCount = 0;
            this.lastReplyReset = now;
        }
        return this.replyCount < this.config.maxRepliesPerMinute;
    }
    async cleanup() {
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
        }
        catch (error) {
            console.error('Error during TwitterStreamHandler cleanup:', error);
            throw error;
        }
    }
}
