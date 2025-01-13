// src/services/market/signals/marketSentiment.ts
import { EventEmitter } from 'events';
export var SentimentSource;
(function (SentimentSource) {
    SentimentSource["SOCIAL"] = "social";
    SentimentSource["NEWS"] = "news";
    SentimentSource["TRADING"] = "trading";
    SentimentSource["FORUMS"] = "forums";
    SentimentSource["INFLUENCERS"] = "influencers";
})(SentimentSource || (SentimentSource = {}));
export class MarketSentimentAnalyzer extends EventEmitter {
    aiService;
    sentimentData;
    CONFIDENCE_THRESHOLD = 0.6;
    DATA_RETENTION = 7 * 24 * 60 * 60 * 1000; // 7 days
    UPDATE_INTERVAL = 300000; // 5 minutes
    constructor(aiService) {
        super();
        this.aiService = aiService;
        this.sentimentData = new Map();
        this.startPeriodicAnalysis();
    }
    startPeriodicAnalysis() {
        setInterval(() => {
            this.analyzeSentiment();
        }, this.UPDATE_INTERVAL);
    }
    isSignificantData(data) {
        return data.confidence >= this.CONFIDENCE_THRESHOLD;
    }
    getFilteredData(filter) {
        const now = Date.now();
        return Array.from(this.sentimentData.values()).filter(data => {
            const withinTimeRange = !filter?.timeRange ||
                (data.timestamp >= filter.timeRange.start && data.timestamp <= filter.timeRange.end);
            const meetsConfidence = !filter?.confidenceThreshold ||
                data.confidence >= filter.confidenceThreshold;
            const matchesSource = !filter?.sources ||
                filter.sources.includes(data.source);
            const withinRetention = now - data.timestamp <= this.DATA_RETENTION;
            return withinTimeRange && meetsConfidence && matchesSource && withinRetention;
        });
    }
    getDefaultAnalysis() {
        return {
            overall: 0,
            weightedScore: 0,
            distribution: {
                bullish: 0,
                bearish: 0,
                neutral: 0
            },
            confidence: 0,
            dominantSources: [],
            trends: {
                shortTerm: 'neutral',
                mediumTerm: 'neutral',
                longTerm: 'neutral'
            }
        };
    }
    async performAnalysis(data) {
        // Implement sentiment analysis logic using AIService
        const dataString = JSON.stringify(data);
        const analysis = (await this.aiService.analyzeSentiment(dataString)).toString();
        return JSON.parse(analysis);
    }
    async addSentimentData(data) {
        const id = `sentiment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const sentimentData = {
            ...data,
            id,
            timestamp: Date.now()
        };
        this.sentimentData.set(id, sentimentData);
        this.emit('sentimentAdded', sentimentData);
        // Trigger analysis if significant new data
        if (this.isSignificantData(sentimentData)) {
            await this.analyzeSentiment();
        }
    }
    async analyzeSentiment(filter) {
        try {
            const relevantData = this.getFilteredData(filter);
            // Skip analysis if insufficient data
            if (relevantData.length < 10) {
                return this.getDefaultAnalysis();
            }
            const analysis = await this.performAnalysis(relevantData);
            this.emit('analysisCompleted', analysis);
            return analysis;
        }
        catch (error) {
            console.error('Error analyzing sentiment:', error);
            throw error;
        }
    }
}
