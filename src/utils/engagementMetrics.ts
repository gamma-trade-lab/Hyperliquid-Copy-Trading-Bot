// src/utils/engagementMetrics.ts

interface EngagementMetric {
    value: number;
    weight: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    confidence: number;
    timestamp: number;
  }
  
  interface EngagementScore {
    total: number;
    metrics: Record<string, EngagementMetric>;
    analysis: {
      strengths: string[];
      weaknesses: string[];
      recommendations: string[];
    };
    metadata: {
      timeframe: string;
      sampleSize: number;
      confidence: number;
    };
  }
  
  interface MetricsConfig {
    weights: Record<string, number>;
    thresholds: Record<string, number>;
    timeframes: Record<string, number>;
  }
  
  export class EngagementMetrics {
    private readonly DEFAULT_CONFIG: MetricsConfig = {
      weights: {
        likes: 1,
        comments: 2,
        shares: 3,
        clicks: 1.5,
        saves: 2,
        impressions: 0.5,
        retention: 2.5
      },
      thresholds: {
        viralThreshold: 1000,
        engagementRate: 0.05,
        retentionRate: 0.6,
        responseRate: 0.1
      },
      timeframes: {
        recent: 24 * 60 * 60 * 1000, // 24 hours
        medium: 7 * 24 * 60 * 60 * 1000, // 7 days
        long: 30 * 24 * 60 * 60 * 1000 // 30 days
      }
    };
  
    private config: MetricsConfig;
  
    constructor(config: Partial<MetricsConfig> = {}) {
      this.config = {
        weights: { ...this.DEFAULT_CONFIG.weights, ...config.weights },
        thresholds: { ...this.DEFAULT_CONFIG.thresholds, ...config.thresholds },
        timeframes: { ...this.DEFAULT_CONFIG.timeframes, ...config.timeframes }
      };
    }
  
    public calculateEngagementScore(
      metrics: Record<string, number[]>
    ): EngagementScore {
      try {
        const processedMetrics: Record<string, EngagementMetric> = {};
  
        // Process each metric
        for (const [key, values] of Object.entries(metrics)) {
          processedMetrics[key] = this.processMetric(key, values);
        }
  
        // Calculate total score
        const total = this.calculateTotalScore(processedMetrics);
  
        // Generate analysis
        const analysis = this.analyzeMetrics(processedMetrics, total);
  
        return {
          total,
          metrics: processedMetrics,
          analysis,
          metadata: {
            timeframe: this.determineTimeframe(metrics),
            sampleSize: this.calculateSampleSize(metrics),
            confidence: this.calculateConfidence(metrics)
          }
        };
      } catch (error) {
        console.error('Error calculating engagement score:', error);
        throw error;
      }
    }
  
    private processMetric(
      key: string,
      values: number[]
    ): EngagementMetric {
      if (!values.length) {
        throw new Error(`No values provided for metric: ${key}`);
      }
  
      const weight = this.config.weights[key] || 1;
      const value = this.calculateAverageValue(values);
      const trend = this.calculateTrend(values);
      const confidence = this.calculateMetricConfidence(values);
  
      return {
        value,
        weight,
        trend,
        confidence,
        timestamp: Date.now()
      };
    }

    private calculateTotalScore(metrics: Record<string, EngagementMetric>): number {
        return Object.values(metrics).reduce((total, metric) => {
            return total + metric.value * metric.weight;
        }, 0);
    }

    private analyzeMetrics(metrics: Record<string, EngagementMetric>, total: number) {
        const strengths: string[] = [];
        const weaknesses: string[] = [];
        const recommendations: string[] = [];

        for (const [key, metric] of Object.entries(metrics)) {
            if (metric.trend === 'increasing') {
                strengths.push(key);
            } else if (metric.trend === 'decreasing') {
                weaknesses.push(key);
                recommendations.push(`Improve ${key}`);
            }
        }

        return { strengths, weaknesses, recommendations };
    }

    private determineTimeframe(metrics: Record<string, number[]>): string {
        const recentTimeframe = this.config.timeframes.recent;
        const mediumTimeframe = this.config.timeframes.medium;
        const longTimeframe = this.config.timeframes.long;

        const recentMetrics = Object.values(metrics).some(values =>
            values.some(value => Date.now() - value < recentTimeframe)
        );
        const mediumMetrics = Object.values(metrics).some(values =>
            values.some(value => Date.now() - value < mediumTimeframe)
        );
        const longMetrics = Object.values(metrics).some(values =>
            values.some(value => Date.now() - value < longTimeframe)
        );

        if (recentMetrics) return 'recent';
        if (mediumMetrics) return 'medium';
        if (longMetrics) return 'long';
        return 'unknown';
    }

    private calculateSampleSize(metrics: Record<string, number[]>): number {
        return Object.values(metrics).reduce((total, values) => total + values.length, 0);
    }

    private calculateConfidence(metrics: Record<string, number[]>): number {
        const sampleSize = this.calculateSampleSize(metrics);
        return Math.min(1, sampleSize / 100);
    }

    private calculateAverageValue(values: number[]): number {
        const sum = values.reduce((total, value) => total + value, 0);
        return sum / values.length;
    }

    private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
        if (values.length < 2) return 'stable';
        const [first, ...rest] = values;
        const last = rest[rest.length - 1];
        if (last > first) return 'increasing';
        if (last < first) return 'decreasing';
        return 'stable';
    }

    private calculateMetricConfidence(values: number[]): number {
        return Math.min(1, values.length / 10);
    }
  }