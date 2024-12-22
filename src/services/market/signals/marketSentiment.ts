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