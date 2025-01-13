import { EventEmitter } from 'events';
import { SentimentAnalyzer } from './analytics/sentiment.js';
import { Platform } from '../../personality/traits/responsePatterns.js';
import { CONFIG } from '../../config/settings.js';
export class CommunityEngagementService extends EventEmitter {
    twitterClient;
    aiService;
    contentStrategy;
    sentimentAnalyzer;
    lastEngagement = Date.now();
    constructor(twitterClient, aiService, contentStrategy) {
        super();
        this.twitterClient = twitterClient;
        this.aiService = aiService;
        this.contentStrategy = contentStrategy;
        this.sentimentAnalyzer = new SentimentAnalyzer(aiService);
    }
    async startAutomatedEngagement() {
        console.log('Starting automated community engagement...');
        // Schedule periodic community engagement
        this.scheduleEngagement();
    }
    scheduleEngagement() {
        const engage = async () => {
            try {
                // Get community metrics
                const metrics = await this.getCommunityMetrics();
                // Generate engagement content using content strategy
                const content = await this.contentStrategy.generateContent({
                    platform: Platform.TWITTER,
                    marketCondition: metrics.activity,
                    communityMood: metrics.engagement,
                    recentEvents: [],
                    timeSlot: new Date().getHours().toString().padStart(2, '0') + ':00'
                });
                // Post engagement content
                await this.twitterClient.v2.tweet(content);
                // Update metrics
                this.emit('engagement', {
                    timestamp: Date.now(),
                    metrics: {
                        followers: metrics.followers.toString(),
                        engagement: metrics.engagement.toString(),
                        activity: metrics.activity
                    }
                });
            }
            catch (error) {
                console.error('Community engagement error:', error);
            }
        };
        // Initial engagement
        engage();
        // Schedule periodic engagement
        setInterval(engage, CONFIG.AUTOMATION.COMMUNITY_ENGAGEMENT_INTERVAL);
    }
    async getCommunityMetrics() {
        try {
            // Get performance metrics from content strategy
            const contentMetrics = await this.contentStrategy.getPerformanceMetrics();
            // Calculate engagement rate from content metrics
            const engagement = contentMetrics.overall.engagementRate;
            // Get sentiment metrics
            const sentiment = await this.sentimentAnalyzer.getAggregatedSentiment();
            // Determine activity level based on engagement and sentiment
            const activity = this.determineActivityLevel(engagement, sentiment.overallScore);
            return {
                followers: await this.getFollowerCount(),
                engagement,
                activity
            };
        }
        catch (error) {
            console.error('Error getting community metrics:', error);
            return {
                followers: 0,
                engagement: 0,
                activity: 'normal'
            };
        }
    }
    async getFollowerCount() {
        try {
            const { data } = await this.twitterClient.v2.me();
            return data.public_metrics ? data.public_metrics.followers_count ?? 0 : 0;
        }
        catch (error) {
            console.error('Error getting follower count:', error);
            return 0;
        }
    }
    determineActivityLevel(engagement, sentiment) {
        // Determine activity level based on engagement rate and sentiment
        if (engagement > 0.1 && sentiment > 0.5)
            return 'high';
        if (engagement > 0.05 || sentiment > 0.3)
            return 'moderate';
        return 'normal';
    }
}
