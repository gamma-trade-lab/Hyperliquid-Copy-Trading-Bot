// src/personality/strategies/contentStrategy.ts

import { TraitManager, TraitCategory } from '../traits';
import { MemeGenerator } from '../traits/memeGenerator';
import { ResponsePatternManager, ResponseType, Platform } from '../traits/responsePatterns';
import { EventEmitter } from 'events';

interface ContentSchedule {
  timeSlot: string;
  type: ContentType;
  priority: number;
  conditions: ContentCondition[];
}

interface ContentCondition {
  type: 'market' | 'community' | 'time' | 'engagement';
  value: string | number;
  operator: 'eq' | 'gt' | 'lt' | 'contains';
}

enum ContentType {
  MEME = 'meme',
  ANALYSIS = 'analysis',
  UPDATE = 'update',
  ENGAGEMENT = 'engagement',
  EDUCATIONAL = 'educational'
}

interface ContentMetrics {
  engagementRate: number;
  sentimentScore: number;
  viralScore: number;
  conversionRate: number;
  timestamp: number;
}

export class ContentStrategy extends EventEmitter {
  private traitManager: TraitManager;
  private memeGenerator: MemeGenerator;
  private responseManager: ResponsePatternManager;
  private schedule: Map<string, ContentSchedule>;
  private contentHistory: Map<string, ContentMetrics>;
  private readonly MAX_HISTORY_ITEMS = 1000;

  constructor(
    traitManager: TraitManager,
    memeGenerator: MemeGenerator,
    responseManager: ResponsePatternManager
  ) {
    super();
    this.traitManager = traitManager;
    this.memeGenerator = memeGenerator;
    this.responseManager = responseManager;
    this.schedule = new Map();
    this.contentHistory = new Map();
    this.initializeDefaultSchedule();
  }

  private initializeDefaultSchedule(): void {
    // Market-driven content schedule
    this.addScheduleItem({
      timeSlot: '08:00',
      type: ContentType.ANALYSIS,
      priority: 1,
      conditions: [
        { type: 'market', value: 'active', operator: 'eq' },
        { type: 'engagement', value: 50, operator: 'gt' }
      ]
    });

    // Community engagement schedule
    this.addScheduleItem({
      timeSlot: '12:00',
      type: ContentType.MEME,
      priority: 2,
      conditions: [
        { type: 'community', value: 'active', operator: 'eq' },
        { type: 'time', value: 'peak', operator: 'eq' }
      ]
    });
  }

  public async generateContent(
    context: {
      platform: Platform;
      marketCondition: string;
      communityMood: number;
      recentEvents: string[];
      timeSlot: string;
    }
  ): Promise<string> {
    try {
      const schedule = this.getScheduleForTimeSlot(context.timeSlot);
      if (!schedule || !this.checkConditions(schedule.conditions, context)) {
        return this.generateFallbackContent(context);
      }

      const content = await this.generateContentByType(schedule.type, context);
      await this.trackContentMetrics(content, schedule.type);
      
      return content;
    } catch (error) {
      console.error('Error generating content:', error);
      throw error;
    }
  }

  private async generateContentByType(
    type: ContentType,
    context: any
  ): Promise<string> {
    switch (type) {
      case ContentType.MEME:
        return await this.generateMemeContent(context);
      case ContentType.ANALYSIS:
        return await this.generateAnalysisContent(context);
      case ContentType.UPDATE:
        return await this.generateUpdateContent(context);
      case ContentType.ENGAGEMENT:
        return await this.generateEngagementContent(context);
      case ContentType.EDUCATIONAL:
        return await this.generateEducationalContent(context);
      default:
        throw new Error(`Unsupported content type: ${type}`);
    }
  }

  private async generateMemeContent(context: any): Promise<string> {
    const generatedMeme = await this.memeGenerator.generateMeme({
      marketCondition: context.marketCondition,
      recentEvents: context.recentEvents,
      communityMood: context.communityMood,
      targetAudience: ['traders', 'holders']
    });
    return generatedMeme.getUrl(); // Assuming the GeneratedMeme object has a 'getUrl' method
  }

  private async generateAnalysisContent(context: any): Promise<string> {
    return await this.responseManager.generateResponse(
      ResponseType.MARKET_ANALYSIS,
      {
        platform: context.platform,
        audience: ['traders', 'analysts'],
        marketCondition: context.marketCondition,
        urgency: 0.7,
        previousResponses: []
      },
      {
        token: 'SOL',
        pattern: 'trending',
        conclusion: 'analysis pending'
      }
    );
  }

  private async generateUpdateContent(context: any): Promise<string> {
    return await this.responseManager.generateResponse(
      ResponseType.COMMUNITY_ENGAGEMENT,
      {
        platform: context.platform,
        audience: ['community', 'holders'],
        marketCondition: context.marketCondition,
        urgency: 0.5,
        previousResponses: []
      },
      {
        update: context.recentEvents[0],
        impact: 'positive'
      }
    );
  }

  private async generateEngagementContent(context: any): Promise<string> {
    const traits = this.traitManager.getTraitsByCategory(TraitCategory.SOCIAL);
    const engagementLevel = traits.reduce((acc, trait) => acc + trait.weight, 0) / traits.length;

    return await this.responseManager.generateResponse(
      ResponseType.COMMUNITY_ENGAGEMENT,
      {
        platform: context.platform,
        audience: ['community'],
        marketCondition: context.marketCondition,
        urgency: engagementLevel,
        previousResponses: []
      },
      {
        topic: 'community',
        mood: context.communityMood
      }
    );
  }

  private async generateEducationalContent(context: any): Promise<string> {
    return await this.responseManager.generateResponse(
      ResponseType.TECHNICAL_EXPLANATION,
      {
        platform: context.platform,
        audience: ['newcomers', 'learners'],
        marketCondition: context.marketCondition,
        urgency: 0.3,
        previousResponses: []
      },
      {
        topic: 'defi',
        complexity: 'medium'
      }
    );
  }

  private async generateFallbackContent(context: any): Promise<string> {
    // Generate safe, general-purpose content when no schedule matches
    return await this.responseManager.generateResponse(
      ResponseType.COMMUNITY_ENGAGEMENT,
      {
        platform: context.platform,
        audience: ['general'],
        marketCondition: context.marketCondition,
        urgency: 0.4,
        previousResponses: []
      },
      {
        type: 'general',
        mood: 'neutral'
      }
    );
  }

  private checkConditions(
    conditions: ContentCondition[],
    context: any
  ): boolean {
    return conditions.every(condition => {
      const contextValue = context[condition.type];
      switch (condition.operator) {
        case 'eq':
          return contextValue === condition.value;
        case 'gt':
          return contextValue > condition.value;
        case 'lt':
          return contextValue < condition.value;
        case 'contains':
          return contextValue.includes(condition.value);
        default:
          return false;
      }
    });
  }

  private async trackContentMetrics(
    content: string,
    type: ContentType
  ): Promise<void> {
    const metrics: ContentMetrics = {
      engagementRate: 0,
      sentimentScore: 0,
      viralScore: 0,
      conversionRate: 0,
      timestamp: Date.now()
    };

    this.contentHistory.set(`${type}-${Date.now()}`, metrics);

    // Maintain history size
    if (this.contentHistory.size > this.MAX_HISTORY_ITEMS) {
      const oldestKey = Array.from(this.contentHistory.keys())[0];
      this.contentHistory.delete(oldestKey);
    }

    this.emit('metricsUpdated', { type, metrics });
  }

  public addScheduleItem(schedule: ContentSchedule): void {
    this.schedule.set(`${schedule.timeSlot}-${schedule.type}`, schedule);
  }

  private getScheduleForTimeSlot(timeSlot: string): ContentSchedule | undefined {
    return Array.from(this.schedule.values())
      .find(schedule => schedule.timeSlot === timeSlot);
  }

  public getContentHistory(
    type?: ContentType,
    timeRange?: { start: number; end: number }
  ): Map<string, ContentMetrics> {
    let history = new Map(this.contentHistory);

    if (type) {
      history = new Map(
        Array.from(history.entries())
          .filter(([key]) => key.startsWith(type))
      );
    }

    if (timeRange) {
      history = new Map(
        Array.from(history.entries())
          .filter(([, metrics]) => 
            metrics.timestamp >= timeRange.start &&
            metrics.timestamp <= timeRange.end
          )
      );
    }

    return history;
  }

  public getPerformanceMetrics(): {
    byType: Record<ContentType, ContentMetrics>;
    overall: ContentMetrics;
  } {
    const byType: Record<ContentType, ContentMetrics> = {} as Record<ContentType, ContentMetrics>;
    let overall: ContentMetrics = {
      engagementRate: 0,
      sentimentScore: 0,
      viralScore: 0,
      conversionRate: 0,
      timestamp: Date.now()
    };

    // Calculate metrics by type
    Object.values(ContentType).forEach(type => {
      const typeMetrics = Array.from(this.contentHistory.entries())
        .filter(([key]) => key.startsWith(type));

      if (typeMetrics.length > 0) {
        byType[type] = {
          engagementRate: this.average(typeMetrics.map(([, m]) => m.engagementRate)),
          sentimentScore: this.average(typeMetrics.map(([, m]) => m.sentimentScore)),
          viralScore: this.average(typeMetrics.map(([, m]) => m.viralScore)),
          conversionRate: this.average(typeMetrics.map(([, m]) => m.conversionRate)),
          timestamp: Date.now()
        };
      }
    });

    // Calculate overall metrics
    const allMetrics = Array.from(this.contentHistory.values());
    if (allMetrics.length > 0) {
      overall = {
        engagementRate: this.average(allMetrics.map(m => m.engagementRate)),
        sentimentScore: this.average(allMetrics.map(m => m.sentimentScore)),
        viralScore: this.average(allMetrics.map(m => m.viralScore)),
        conversionRate: this.average(allMetrics.map(m => m.conversionRate)),
        timestamp: Date.now()
      };
    }

    return { byType, overall };
  }

  private average(numbers: number[]): number {
    return numbers.reduce((acc, val) => acc + val, 0) / numbers.length;
  }
}