// src/community/engagement/tracker.ts

import { Platform } from '../../personality/traits/responsePatterns.js';
import { EventEmitter } from 'events';


interface EngagementEvent {
  id: string;
  userId: string;
  type: EngagementType;
  platform: Platform;
  content?: string;
  metadata: {
    timestamp: number;
    context: string;
    referenceId?: string;
    metrics?: EngagementMetrics;
  };
}

interface EngagementMetrics {
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  clickThrough?: number;
  retention?: number;
}

enum EngagementType {
  POST = 'post',
  COMMENT = 'comment',
  REACTION = 'reaction',
  SHARE = 'share',
  CLICK = 'click',
  VIEW = 'view',
  REFERRAL = 'referral'
}

interface UserEngagement {
  userId: string;
  totalEvents: number;
  lastActive: number;
  metrics: {
    posts: number;
    comments: number;
    reactions: number;
    shares: number;
  };
  score: number;
  badges: string[];
}

export class EngagementTracker extends EventEmitter {
  private events: Map<string, EngagementEvent>;
  private userEngagement: Map<string, UserEngagement>;
  private readonly RETENTION_WINDOW = 30 * 24 * 60 * 60 * 1000; // 30 days
  private readonly SCORE_WEIGHTS = {
    post: 5,
    comment: 3,
    reaction: 1,
    share: 4,
    click: 1,
    view: 0.1,
    referral: 10
  };

  constructor() {
    super();
    this.events = new Map();
    this.userEngagement = new Map();
    this.startPeriodicAnalysis();
  }

  public async trackEvent(
    userId: string,
    type: EngagementType,
    platform: Platform,
    content?: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    try {
      const eventId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const event: EngagementEvent = {
        id: eventId,
        userId,
        type,
        platform,
        content,
        metadata: {
          timestamp: Date.now(),
          context: metadata.context || 'general',
          referenceId: metadata.referenceId,
          metrics: metadata.metrics
        }
      };

      this.events.set(eventId, event);
      await this.updateUserEngagement(userId, event);
      this.emit('eventTracked', event);

      return eventId;
    } catch (error) {
      console.error('Error tracking event:', error);
      throw error;
    }
  }

  private async updateUserEngagement(
    userId: string,
    event: EngagementEvent
  ): Promise<void> {
    let userEngagement = this.userEngagement.get(userId);
    
    if (!userEngagement) {
      userEngagement = {
        userId,
        totalEvents: 0,
        lastActive: 0,
        metrics: {
          posts: 0,
          comments: 0,
          reactions: 0,
          shares: 0
        },
        score: 0,
        badges: []
      };
    }

    // Update metrics
    userEngagement.totalEvents++;
    userEngagement.lastActive = Date.now();

    switch (event.type) {
      case EngagementType.POST:
        userEngagement.metrics.posts++;
        break;
      case EngagementType.COMMENT:
        userEngagement.metrics.comments++;
        break;
      case EngagementType.REACTION:
        userEngagement.metrics.reactions++;
        break;
      case EngagementType.SHARE:
        userEngagement.metrics.shares++;
        break;
    }

    // Calculate score
    userEngagement.score = this.calculateEngagementScore(userEngagement);

    // Update badges
    await this.updateBadges(userEngagement);

    this.userEngagement.set(userId, userEngagement);
    this.emit('userEngagementUpdated', userEngagement);
  }

  private calculateEngagementScore(engagement: UserEngagement): number {
    const recentEvents = this.getRecentEvents(engagement.userId);
    let score = 0;

    // Calculate base score from event weights
    recentEvents.forEach(event => {
      score += this.SCORE_WEIGHTS[event.type] || 0;

      // Add bonus for engagement metrics
      if (event.metadata.metrics) {
        score += (
          event.metadata.metrics.likes * 0.1 +
          event.metadata.metrics.comments * 0.3 +
          event.metadata.metrics.shares * 0.5
        );
      }
    });

    // Apply time decay
    const recencyMultiplier = this.calculateRecencyMultiplier(engagement.lastActive);
    score *= recencyMultiplier;

    // Apply consistency bonus
    const consistencyBonus = this.calculateConsistencyBonus(engagement.userId);
    score *= consistencyBonus;

    return Math.round(score * 100) / 100;
  }

  private calculateRecencyMultiplier(lastActive: number): number {
    const daysInactive = (Date.now() - lastActive) / (24 * 60 * 60 * 1000);
    return Math.max(0.5, 1 - (daysInactive * 0.1));
  }

  private calculateConsistencyBonus(userId: string): number {
    const recentEvents = this.getRecentEvents(userId);
    const dailyEvents = new Map<string, number>();

    recentEvents.forEach(event => {
      const date = new Date(event.metadata.timestamp).toDateString();
      dailyEvents.set(date, (dailyEvents.get(date) || 0) + 1);
    });

    const activeDays = dailyEvents.size;
    const totalDays = 30;
    const consistencyRatio = activeDays / totalDays;

    return 1 + (consistencyRatio * 0.5);
  }

  private async updateBadges(engagement: UserEngagement): Promise<void> {
    const newBadges: string[] = [];

    // Post count badges
    if (engagement.metrics.posts >= 100) newBadges.push('prolific-poster');
    if (engagement.metrics.posts >= 500) newBadges.push('content-creator');

    // Comment count badges
    if (engagement.metrics.comments >= 200) newBadges.push('active-commenter');
    if (engagement.metrics.comments >= 1000) newBadges.push('conversation-master');

    // Score badges
    if (engagement.score >= 1000) newBadges.push('engagement-pro');
    if (engagement.score >= 5000) newBadges.push('community-leader');

    // Add new badges
    newBadges.forEach(badge => {
      if (!engagement.badges.includes(badge)) {
        engagement.badges.push(badge);
        this.emit('badgeEarned', { userId: engagement.userId, badge });
      }
    });
  }

  private getRecentEvents(userId: string): EngagementEvent[] {
    const cutoff = Date.now() - this.RETENTION_WINDOW;
    return Array.from(this.events.values())
      .filter(event => 
        event.userId === userId &&
        event.metadata.timestamp >= cutoff
      )
      .sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);
  }

  private startPeriodicAnalysis(): void {
    setInterval(() => {
      this.analyzeEngagementTrends();
    }, 3600000); // Every hour
  }

  private async analyzeEngagementTrends(): Promise<void> {
    const trends = {
      activeUsers: this.getActiveUsers(),
      topContent: this.getTopContent(),
      engagementRates: this.calculateEngagementRates(),
      retentionMetrics: await this.calculateRetentionMetrics()
    };

    this.emit('trendsAnalyzed', trends);
  }

  public getUserEngagement(userId: string): UserEngagement | null {
    return this.userEngagement.get(userId) || null;
  }

  public getTopEngagedUsers(limit: number = 10): UserEngagement[] {
    return Array.from(this.userEngagement.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  public getEventHistory(
    userId: string,
    type?: EngagementType
  ): EngagementEvent[] {
    return Array.from(this.events.values())
      .filter(event => 
        event.userId === userId &&
        (!type || event.type === type)
      )
      .sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);
  }

  private getActiveUsers(): number {
    const now = Date.now();
    const dayAgo = now - (24 * 60 * 60 * 1000);
    
    return Array.from(this.userEngagement.values())
      .filter(user => user.lastActive >= dayAgo)
      .length;
  }

  private getTopContent(): Array<{ content: string; metrics: EngagementMetrics }> {
    return Array.from(this.events.values())
      .filter(event => event.content && event.metadata.metrics)
      .sort((a, b) => {
        const scoreA = this.calculateContentScore(a.metadata.metrics!);
        const scoreB = this.calculateContentScore(b.metadata.metrics!);
        return scoreB - scoreA;
      })
      .slice(0, 10)
      .map(event => ({
        content: event.content!,
        metrics: event.metadata.metrics!
      }));
  }

  private calculateContentScore(metrics: EngagementMetrics): number {
    return (
      metrics.likes +
      metrics.comments * 3 +
      metrics.shares * 5 +
      (metrics.clickThrough || 0) * 2
    );
  }

  private calculateEngagementRates(): Record<string, number> {
    const total = Array.from(this.events.values()).length;
    const byType = new Map<string, number>();

    this.events.forEach(event => {
      byType.set(event.type, (byType.get(event.type) || 0) + 1);
    });

    const rates: Record<string, number> = {};
    byType.forEach((count, type) => {
      rates[type] = count / total;
    });

    return rates;
  }

  private async calculateRetentionMetrics(): Promise<{
    daily: number;
    weekly: number;
    monthly: number;
  }> {
    const now = Date.now();
    const users = Array.from(this.userEngagement.values());

    return {
      daily: this.calculateRetentionRate(users, now - 24 * 60 * 60 * 1000),
      weekly: this.calculateRetentionRate(users, now - 7 * 24 * 60 * 60 * 1000),
      monthly: this.calculateRetentionRate(users, now - 30 * 24 * 60 * 60 * 1000)
    };
  }

  private calculateRetentionRate(users: UserEngagement[], since: number): number {
    const retained = users.filter(user => user.lastActive >= since).length;
    return retained / users.length;
  }
}
