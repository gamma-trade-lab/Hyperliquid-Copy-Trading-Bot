// src/utils/engagementMetrics.ts
export class EngagementMetrics {
    DEFAULT_CONFIG = {
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
    config;
    constructor(config = {}) {
        this.config = {
            weights: { ...this.DEFAULT_CONFIG.weights, ...config.weights },
            thresholds: { ...this.DEFAULT_CONFIG.thresholds, ...config.thresholds },
            timeframes: { ...this.DEFAULT_CONFIG.timeframes, ...config.timeframes }
        };
    }
    calculateEngagementScore(metrics) {
        try {
            const processedMetrics = {};
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
        }
        catch (error) {
            console.error('Error calculating engagement score:', error);
            throw error;
        }
    }
    processMetric(key, values) {
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
    calculateTotalScore(metrics) {
        return Object.values(metrics).reduce((total, metric) => {
            return total + metric.value * metric.weight;
        }, 0);
    }
    analyzeMetrics(metrics, total) {
        const strengths = [];
        const weaknesses = [];
        const recommendations = [];
        for (const [key, metric] of Object.entries(metrics)) {
            if (metric.trend === 'increasing') {
                strengths.push(key);
            }
            else if (metric.trend === 'decreasing') {
                weaknesses.push(key);
                recommendations.push(`Improve ${key}`);
            }
        }
        return { strengths, weaknesses, recommendations };
    }
    determineTimeframe(metrics) {
        const recentTimeframe = this.config.timeframes.recent;
        const mediumTimeframe = this.config.timeframes.medium;
        const longTimeframe = this.config.timeframes.long;
        const recentMetrics = Object.values(metrics).some(values => values.some(value => Date.now() - value < recentTimeframe));
        const mediumMetrics = Object.values(metrics).some(values => values.some(value => Date.now() - value < mediumTimeframe));
        const longMetrics = Object.values(metrics).some(values => values.some(value => Date.now() - value < longTimeframe));
        if (recentMetrics)
            return 'recent';
        if (mediumMetrics)
            return 'medium';
        if (longMetrics)
            return 'long';
        return 'unknown';
    }
    calculateSampleSize(metrics) {
        return Object.values(metrics).reduce((total, values) => total + values.length, 0);
    }
    calculateConfidence(metrics) {
        const sampleSize = this.calculateSampleSize(metrics);
        return Math.min(1, sampleSize / 100);
    }
    calculateAverageValue(values) {
        const sum = values.reduce((total, value) => total + value, 0);
        return sum / values.length;
    }
    calculateTrend(values) {
        if (values.length < 2)
            return 'stable';
        const [first, ...rest] = values;
        const last = rest[rest.length - 1];
        if (last > first)
            return 'increasing';
        if (last < first)
            return 'decreasing';
        return 'stable';
    }
    calculateMetricConfidence(values) {
        return Math.min(1, values.length / 10);
    }
}
