// src/services/social/analytics/sentiment.ts
import { EventEmitter } from 'events';
export class SentimentAnalyzer extends EventEmitter {
    aiService;
    sentimentHistory;
    HISTORY_LIMIT = 1000;
    SENTIMENT_THRESHOLDS = {
        positive: 0.3,
        negative: -0.3
    };
    constructor(aiService) {
        super();
        this.aiService = aiService;
        this.sentimentHistory = new Map();
    }
    async analyzeSentiment(content, metadata = {}) {
        try {
            // Generate sentiment analysis prompt
            const prompt = this.buildSentimentPrompt(content);
            // Get AI response
            const response = await this.aiService.generateResponse({
                content: prompt,
                author: 'system',
                channel: 'sentiment',
                platform: 'sentiment'
            });
            // Parse AI response into sentiment data
            const sentimentData = this.parseSentimentResponse(response);
            const contentSentiment = {
                id: `sentiment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                content,
                scores: {
                    score: sentimentData.score,
                    magnitude: sentimentData.magnitude,
                    confidence: sentimentData.confidence,
                    timestamp: Date.now()
                },
                topics: sentimentData.topics,
                entities: sentimentData.entities,
                sentiment: this.categorizeSentiment(sentimentData.score),
                metadata
            };
            this.addToHistory(contentSentiment);
            this.emit('sentimentAnalyzed', contentSentiment);
            return contentSentiment;
        }
        catch (error) {
            console.error('Error analyzing sentiment:', error);
            throw error;
        }
    }
    async analyzeMultiple(contents) {
        return await Promise.all(contents.map(({ content, metadata = {} }) => this.analyzeSentiment(content, metadata)));
    }
    getAggregatedSentiment(timeframe = {
        start: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
        end: Date.now()
    }) {
        const relevantSentiments = Array.from(this.sentimentHistory.values())
            .filter(s => s.scores.timestamp >= timeframe.start &&
            s.scores.timestamp <= timeframe.end);
        if (relevantSentiments.length === 0) {
            return {
                overallScore: 0,
                distribution: { positive: 0, negative: 0, neutral: 0 },
                topTopics: [],
                trend: 'stable'
            };
        }
        // Calculate overall score
        const overallScore = this.calculateAverageScore(relevantSentiments);
        // Calculate distribution
        const distribution = this.calculateSentimentDistribution(relevantSentiments);
        // Analyze topics
        const topTopics = this.analyzeTopics(relevantSentiments);
        // Determine trend
        const trend = this.determineTrend(relevantSentiments);
        return {
            overallScore,
            distribution,
            topTopics,
            trend
        };
    }
    getTopicSentiment(topic) {
        const topicSentiments = Array.from(this.sentimentHistory.values())
            .filter(s => s.topics.includes(topic));
        if (topicSentiments.length === 0) {
            return { score: 0, mentions: 0, trend: 'stable' };
        }
        const score = this.calculateAverageScore(topicSentiments);
        const trend = this.determineTrend(topicSentiments);
        return {
            score,
            mentions: topicSentiments.length,
            trend
        };
    }
    buildSentimentPrompt(content) {
        return `
      Analyze the sentiment of the following content:
      "${content}"
      
      Provide analysis including:
      1. Sentiment score (-1 to 1)
      2. Magnitude (0 to 1)
      3. Confidence score (0 to 1)
      4. Key topics discussed
      5. Named entities mentioned

      Format: JSON
    `;
    }
    parseSentimentResponse(response) {
        try {
            const parsed = JSON.parse(response);
            return {
                score: parsed.sentiment_score,
                magnitude: parsed.magnitude,
                confidence: parsed.confidence,
                topics: parsed.topics || [],
                entities: parsed.entities || []
            };
        }
        catch (error) {
            console.error('Error parsing sentiment response:', error);
            return {
                score: 0,
                magnitude: 0,
                confidence: 0,
                topics: [],
                entities: []
            };
        }
    }
    categorizeSentiment(score) {
        if (score >= this.SENTIMENT_THRESHOLDS.positive)
            return 'positive';
        if (score <= this.SENTIMENT_THRESHOLDS.negative)
            return 'negative';
        return 'neutral';
    }
    calculateAverageScore(sentiments) {
        return sentiments.reduce((acc, s) => acc + s.scores.score, 0) / sentiments.length;
    }
    calculateSentimentDistribution(sentiments) {
        const total = sentiments.length;
        const counts = sentiments.reduce((acc, s) => {
            acc[s.sentiment]++;
            return acc;
        }, { positive: 0, negative: 0, neutral: 0 });
        return {
            positive: counts.positive / total,
            negative: counts.negative / total,
            neutral: counts.neutral / total
        };
    }
    analyzeTopics(sentiments) {
        const topicScores = new Map();
        // Aggregate scores by topic
        sentiments.forEach(sentiment => {
            sentiment.topics.forEach(topic => {
                const current = topicScores.get(topic) || { total: 0, count: 0 };
                topicScores.set(topic, {
                    total: current.total + sentiment.scores.score,
                    count: current.count + 1
                });
            });
        });
        // Calculate averages and sort
        return Array.from(topicScores.entries())
            .map(([topic, { total, count }]) => ({
            topic,
            score: total / count
        }))
            .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
            .slice(0, 5);
    }
    determineTrend(sentiments) {
        if (sentiments.length < 2)
            return 'stable';
        // Sort by timestamp
        const sorted = [...sentiments].sort((a, b) => a.scores.timestamp - b.scores.timestamp);
        // Calculate moving averages
        const windowSize = Math.max(2, Math.floor(sorted.length / 4));
        const recent = sorted.slice(-windowSize);
        const previous = sorted.slice(-windowSize * 2, -windowSize);
        const recentAvg = this.calculateAverageScore(recent);
        const previousAvg = this.calculateAverageScore(previous);
        const difference = recentAvg - previousAvg;
        const threshold = 0.1;
        if (difference > threshold)
            return 'improving';
        if (difference < -threshold)
            return 'declining';
        return 'stable';
    }
    addToHistory(sentiment) {
        this.sentimentHistory.set(sentiment.id, sentiment);
        // Maintain history limit
        if (this.sentimentHistory.size > this.HISTORY_LIMIT) {
            const oldestKey = Array.from(this.sentimentHistory.keys())[0];
            this.sentimentHistory.delete(oldestKey);
        }
    }
}
