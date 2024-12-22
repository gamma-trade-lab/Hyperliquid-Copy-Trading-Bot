// src/services/market/signals/marketSentiment.ts

import { EventEmitter } from 'events';
import { AIService } from '../../ai/ai';

interface SentimentData {
  id: string;
  source: SentimentSource;
  score: number;
  confidence: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  volume: number;
  timestamp: number;
  metadata: Record<string, any>;
}

interface SentimentAnalysis {
  overall: number;
  weightedScore: number;
  distribution: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  confidence: number;
  dominantSources: Array<{
    source: SentimentSource;
    influence: number;
  }>;
  trends: {
    shortTerm: string;
    mediumTerm: string;
    longTerm: string;
  };
}

enum SentimentSource {
  SOCIAL = 'social',
  NEWS = 'news',
  TRADING = 'trading',
  FORUMS = 'forums',
  INFLUENCERS = 'influencers'
}

interface SentimentFilter {
  sources?: SentimentSource[];
  timeRange?: {
    start: number;
    end: number;
  };
  confidenceThreshold?: number;
}

export class MarketSentimentAnalyzer extends EventEmitter {
  private aiService: AIService;
  private sentimentData: Map<string, SentimentData>;
  private readonly CONFIDENCE_THRESHOLD = 0.6;
  private readonly DATA_RETENTION = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly UPDATE_INTERVAL = 300000; // 5 minutes

  constructor(aiService: AIService) {
    super();
    this.aiService = aiService;
    this.sentimentData = new Map();
    this.startPeriodicAnalysis();
  }

  private startPeriodicAnalysis(): void {
    setInterval(() => {
      this.analyzeSentiment();
    }, this.UPDATE_INTERVAL);
  }

  private isSignificantData(data: SentimentData): boolean {
    return data.confidence >= this.CONFIDENCE_THRESHOLD;
  }

  private getFilteredData(filter?: SentimentFilter): SentimentData[] {
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

  private getDefaultAnalysis(): SentimentAnalysis {
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

  private async performAnalysis(data: SentimentData[]): Promise<SentimentAnalysis> {
    // Implement sentiment analysis logic using AIService
    const dataString = JSON.stringify(data);
    const analysis: string = (await this.aiService.analyzeSentiment(dataString)).toString();
    return JSON.parse(analysis) as SentimentAnalysis;
  }

  public async addSentimentData(
    data: Omit<SentimentData, 'id' | 'timestamp'>
  ): Promise<void> {
    const id = `sentiment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const sentimentData: SentimentData = {
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

  public async analyzeSentiment(
    filter?: SentimentFilter
  ): Promise<SentimentAnalysis> {
    try {
      const relevantData = this.getFilteredData(filter);
      
      // Skip analysis if insufficient data
      if (relevantData.length < 10) {
        return this.getDefaultAnalysis();
      }

      const analysis = await this.performAnalysis(relevantData);
      this.emit('analysisCompleted', analysis);

      return analysis;
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      throw error;
    }
  }
}