import { EventEmitter } from 'events';
import { AIService } from '../ai/ai.js';
import { AgentTwitterClientService } from './agentTwitterClient.js';
import { SentimentAnalyzer } from './analytics/sentiment.js';
import { ContentStrategy } from '../../personality/strategies/contentStrategy.js';
import { Platform } from '../../personality/traits/responsePatterns.js';
import { CONFIG } from '../../config/settings.js';

interface CommunityMetrics {
  followers: number;
  engagement: number;
  activity: string;
}

export class CommunityEngagementService extends EventEmitter {
  private sentimentAnalyzer: SentimentAnalyzer;
  private lastEngagement: number = Date.now();

  constructor(
    private readonly twitterClient: AgentTwitterClientService,
    private readonly aiService: AIService,
    private readonly contentStrategy: ContentStrategy
  ) {
    super();
    this.sentimentAnalyzer = new SentimentAnalyzer(aiService);
  }

  public async startAutomatedEngagement(): Promise<void> {
    console.log('Starting automated community engagement...');
    
    // Schedule periodic community engagement
    this.scheduleEngagement();
  }

  private scheduleEngagement(): void {
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
        await this.twitterClient.postTweet(content);

        // Update metrics
        this.emit('engagement', {
          timestamp: Date.now(),
          metrics: {
            followers: metrics.followers.toString(),
            engagement: metrics.engagement.toString(),
            activity: metrics.activity
          }
        });
      } catch (error) {
        console.error('Community engagement error:', error);
      }
    };

    // Initial engagement
    engage();

    // Schedule periodic engagement
    setInterval(engage, CONFIG.AUTOMATION.COMMUNITY_ENGAGEMENT_INTERVAL);
  }

  private async getCommunityMetrics(): Promise<CommunityMetrics> {
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
    } catch (error) {
      console.error('Error getting community metrics:', error);
      return {
        followers: 0,
        engagement: 0,
        activity: 'normal'
      };
    }
  }

  private async getFollowerCount(): Promise<number> {
    try {
      const profile = await this.twitterClient.getProfile(CONFIG.SOCIAL.TWITTER.username);
      return profile?.followers_count || 0;
    } catch (error) {
      console.error('Error getting follower count:', error);
      return 0;
    }
  }

  private determineActivityLevel(engagement: number, sentiment: number): string {
    // Determine activity level based on engagement rate and sentiment
    if (engagement > 0.1 && sentiment > 0.5) return 'high';
    if (engagement > 0.05 || sentiment > 0.3) return 'moderate';
    return 'normal';
  }
}
