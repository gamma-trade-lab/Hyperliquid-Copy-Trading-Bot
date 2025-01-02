// src/services/social/analytics/sentiment.ts

import { EventEmitter } from 'events';
import { AIService } from '../../ai/ai';

interface SentimentScore {
  score: number;          // -1 to 1
  magnitude: number;      // 0 to 1
  confidence: number;     // 0 to 1
  timestamp: number;
}

interface ContentSentiment {
  id: string;
  content: string;
  scores: SentimentScore;
  topics: string[];
  entities: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  metadata: Record<string, any>;
}

interface AggregatedSentiment {
  overallScore: number;
  distribution: {
    positive: number;
    negative: number;
    neutral: number;
  };
  topTopics: Array<{ topic: string; score: number }>;
  trend: 'improving' | 'declining' | 'stable';
}

interface ResponseContext {
  type: string;
  metadata: Record<string, any>;
}

interface AIServiceRequest {
  content: string;
  context: ResponseContext;
  platform: string;
}

export class SentimentAnalyzer extends EventEmitter {
  private aiService: AIService;
  private sentimentHistory: Map<string, ContentSentiment>;
  private readonly HISTORY_LIMIT = 1000;
  private readonly SENTIMENT_THRESHOLDS = {
    positive: 0.3,
    negative: -0.3
  };

  constructor(aiService: AIService) {
    super();
    this.aiService = aiService;
    this.sentimentHistory = new Map();
  }

  public async analyzeSentiment(
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<ContentSentiment> {
    try {
      // Generate sentiment analysis prompt
      const prompt = this.buildSentimentPrompt(content);
      
      // Get AI response
      const response = await this.aiService.generateResponse({
        content: prompt,
        context: {
          type: 'sentiment_analysis',
          metadata
        } as ResponseContext
      } as AIServiceRequest);

      // Parse AI response into sentiment data
      const sentimentData = this.parseSentimentResponse(response);
      
      const contentSentiment: ContentSentiment = {
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
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      throw error;
    }
  }

  public async analyzeMultiple(
    contents: Array<{ content: string; metadata?: Record<string, any> }>
  ): Promise<ContentSentiment[]> {
    return await Promise.all(
      contents.map(({ content, metadata = {} }) => 
        this.analyzeSentiment(content, metadata)
      )
    );
  }

  public getAggregatedSentiment(
    timeframe: { start: number; end: number } = {
      start: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
      end: Date.now()
    }
  ): AggregatedSentiment {
    const relevantSentiments = Array.from(this.sentimentHistory.values())
      .filter(s => 
        s.scores.timestamp >= timeframe.start &&
        s.scores.timestamp <= timeframe.end
      );

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

  public getTopicSentiment(topic: string): {
    score: number;
    mentions: number;
    trend: 'improving' | 'declining' | 'stable';
  } {
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

  private buildSentimentPrompt(content: string): string {
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

  private parseSentimentResponse(response: string): {
    score: number;
    magnitude: number;
    confidence: number;
    topics: string[];
    entities: string[];
  } {
    try {
      const parsed = JSON.parse(response);
      return {
        score: parsed.sentiment_score,
        magnitude: parsed.magnitude,
        confidence: parsed.confidence,
        topics: parsed.topics || [],
        entities: parsed.entities || []
      };
    } catch (error) {
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

  private categorizeSentiment(score: number): 'positive' | 'negative' | 'neutral' {
    if (score >= this.SENTIMENT_THRESHOLDS.positive) return 'positive';
    if (score <= this.SENTIMENT_THRESHOLDS.negative) return 'negative';
    return 'neutral';
  }

  private calculateAverageScore(sentiments: ContentSentiment[]): number {
    return sentiments.reduce((acc, s) => acc + s.scores.score, 0) / sentiments.length;
  }

  private calculateSentimentDistribution(
    sentiments: ContentSentiment[]
  ): { positive: number; negative: number; neutral: number } {
    const total = sentiments.length;
    const counts = sentiments.reduce(
      (acc, s) => {
        acc[s.sentiment]++;
        return acc;
      },
      { positive: 0, negative: 0, neutral: 0 }
    );

    return {
      positive: counts.positive / total,
      negative: counts.negative / total,
      neutral: counts.neutral / total
    };
  }

  private analyzeTopics(
    sentiments: ContentSentiment[]
  ): Array<{ topic: string; score: number }> {
    const topicScores = new Map<string, { total: number; count: number }>();

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

  private determineTrend(sentiments: ContentSentiment[]): 'improving' | 'declining' | 'stable' {
    if (sentiments.length < 2) return 'stable';

    // Sort by timestamp
    const sorted = [...sentiments].sort((a, b) => 
      a.scores.timestamp - b.scores.timestamp
    );

    // Calculate moving averages
    const windowSize = Math.max(2, Math.floor(sorted.length / 4));
    const recent = sorted.slice(-windowSize);
    const previous = sorted.slice(-windowSize * 2, -windowSize);

    const recentAvg = this.calculateAverageScore(recent);
    const previousAvg = this.calculateAverageScore(previous);

    const difference = recentAvg - previousAvg;
    const threshold = 0.1;

    if (difference > threshold) return 'improving';
    if (difference < -threshold) return 'declining';
    return 'stable';
  }

  private addToHistory(sentiment: ContentSentiment): void {
    this.sentimentHistory.set(sentiment.id, sentiment);

    // Maintain history limit
    if (this.sentimentHistory.size > this.HISTORY_LIMIT) {
      const oldestKey = Array.from(this.sentimentHistory.keys())[0];
      this.sentimentHistory.delete(oldestKey);
    }
  }
}