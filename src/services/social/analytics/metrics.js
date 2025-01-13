// src/services/social/analytics/metrics.ts
import { EventEmitter } from 'events';
import { Platform } from '../../../personality/traits/responsePatterns.js';
var MetricCategory;
(function (MetricCategory) {
    MetricCategory["ENGAGEMENT"] = "engagement";
    MetricCategory["REACH"] = "reach";
    MetricCategory["CONVERSION"] = "conversion";
    MetricCategory["GROWTH"] = "growth";
    MetricCategory["VIRAL"] = "viral";
})(MetricCategory || (MetricCategory = {}));
export class MetricsAnalyzer extends EventEmitter {
    metrics;
    MAX_POINTS_PER_METRIC = 1000;
    TREND_THRESHOLD = 0.05; // 5% change threshold
    constructor() {
        super();
        this.metrics = new Map();
        this.initializeDefaultMetrics();
    }
    initializeDefaultMetrics() {
        // Engagement metrics
        this.addMetric({
            id: 'likes-per-post',
            name: 'Likes per Post',
            category: MetricCategory.ENGAGEMENT,
            points: [],
            metadata: { platform: Platform.TWITTER }
        });
        this.addMetric({
            id: 'comments-per-post',
            name: 'Comments per Post',
            category: MetricCategory.ENGAGEMENT,
            points: [],
            metadata: { platform: Platform.TWITTER }
        });
        // Reach metrics
        this.addMetric({
            id: 'impressions',
            name: 'Impressions',
            category: MetricCategory.REACH,
            points: [],
            metadata: { platform: Platform.TWITTER }
        });
        // Growth metrics
        this.addMetric({
            id: 'follower-growth',
            name: 'Follower Growth',
            category: MetricCategory.GROWTH,
            points: [],
            metadata: { platform: Platform.TWITTER }
        });
        // Viral metrics
        this.addMetric({
            id: 'viral-coefficient',
            name: 'Viral Coefficient',
            category: MetricCategory.VIRAL,
            points: [],
            metadata: { platform: Platform.TWITTER }
        });
    }
    addMetric(metric) {
        this.metrics.set(metric.id, metric);
    }
    async trackMetric(metricId, value, metadata = {}) {
        const metric = this.metrics.get(metricId);
        if (!metric) {
            throw new Error(`Metric not found: ${metricId}`);
        }
        const point = {
            value,
            timestamp: Date.now()
        };
        metric.points.push(point);
        metric.metadata = { ...metric.metadata, ...metadata };
        // Maintain points limit
        if (metric.points.length > this.MAX_POINTS_PER_METRIC) {
            metric.points = metric.points.slice(-this.MAX_POINTS_PER_METRIC);
        }
        this.emit('metricTracked', { metricId, point });
    }
    async trackMultipleMetrics(metrics) {
        await Promise.all(metrics.map(({ metricId, value, metadata = {} }) => this.trackMetric(metricId, value, metadata)));
    }
    getMetricSummary(metricId, timeframe) {
        const metric = this.metrics.get(metricId);
        if (!metric) {
            throw new Error(`Metric not found: ${metricId}`);
        }
        const relevantPoints = metric.points.filter(p => p.timestamp >= timeframe.start && p.timestamp <= timeframe.end);
        if (relevantPoints.length === 0) {
            return {
                current: 0,
                previous: 0,
                change: 0,
                trend: 'stable',
                volatility: 0
            };
        }
        // Calculate current value (average of last 3 points)
        const current = this.calculateAverage(relevantPoints.slice(-3).map(p => p.value));
        // Calculate previous value
        const previous = this.calculateAverage(relevantPoints.slice(-6, -3).map(p => p.value));
        // Calculate change
        const change = previous !== 0 ? (current - previous) / previous : 0;
        // Determine trend
        const trend = change > this.TREND_THRESHOLD ? 'up' : change < -this.TREND_THRESHOLD ? 'down' : 'stable';
        // Calculate volatility (standard deviation of values)
        const volatility = this.calculateVolatility(relevantPoints.map(p => p.value));
        return {
            current,
            previous,
            change,
            trend,
            volatility
        };
    }
    calculateAverage(values) {
        if (values.length === 0)
            return 0;
        const sum = values.reduce((acc, val) => acc + val, 0);
        return sum / values.length;
    }
    calculateVolatility(values) {
        if (values.length === 0)
            return 0;
        const average = this.calculateAverage(values);
        const variance = values.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) / values.length;
        return Math.sqrt(variance);
    }
}
