// src/services/social/viral/trendDetector.ts
import { EventEmitter } from 'events';
export var TrendStage;
(function (TrendStage) {
    TrendStage[TrendStage["EMERGING"] = 0] = "EMERGING";
    TrendStage[TrendStage["PEAK"] = 1] = "PEAK";
    TrendStage[TrendStage["DECLINE"] = 2] = "DECLINE";
    TrendStage[TrendStage["DEAD"] = 3] = "DEAD";
    TrendStage[TrendStage["RISING"] = 4] = "RISING";
    TrendStage[TrendStage["PEAKING"] = 5] = "PEAKING";
    TrendStage[TrendStage["DECLINING"] = 6] = "DECLINING";
})(TrendStage || (TrendStage = {}));
export class TrendDetector extends EventEmitter {
    activeSignals;
    historicalTrends;
    SIGNAL_THRESHOLD = 0.6;
    TREND_TIMEOUT = 3600000; // 1 hour
    MINIMUM_SOURCES = 3;
    constructor() {
        super();
        this.activeSignals = new Map();
        this.historicalTrends = new Map();
    }
    async detectTrends(platform, signals) {
        const detectedTrends = new Map();
        // Process each signal
        for (const signal of signals) {
            const processedSignal = await this.processSignal(platform, signal);
            if (processedSignal && this.isSignificantTrend(processedSignal)) {
                detectedTrends.set(processedSignal.id, processedSignal);
            }
        }
        // Update active signals
        this.updateActiveSignals(detectedTrends);
        return detectedTrends;
    }
    async processSignal(platform, signal) {
        try {
            const signalId = `${platform}-${signal.topic}-${Date.now()}`;
            // Calculate signal strength and velocity
            const strength = this.calculateSignalStrength(signal);
            const velocity = this.calculateSignalVelocity(signal);
            if (strength < this.SIGNAL_THRESHOLD) {
                return null;
            }
            const processedSignal = {
                id: signalId,
                topic: signal.topic || '',
                platform,
                strength,
                velocity,
                timestamp: Date.now(),
                sources: signal.sources || [],
                relatedTopics: signal.relatedTopics || [],
                sentiment: signal.sentiment || 0
            };
            this.emit('signalProcessed', processedSignal);
            return processedSignal;
        }
        catch (error) {
            console.error('Error processing signal:', error);
            return null;
        }
    }
    calculateSignalStrength(signal) {
        let strength = 0;
        // Source diversity factor
        const sourceDiversity = (signal.sources?.length || 0) / this.MINIMUM_SOURCES;
        strength += sourceDiversity * 0.3;
        // Sentiment impact
        const sentimentImpact = Math.abs(signal.sentiment || 0);
        strength += sentimentImpact * 0.2;
        // Related topics factor
        const topicRelevance = (signal.relatedTopics?.length || 0) / 5;
        strength += topicRelevance * 0.2;
        // Historical performance factor
        const historicalFactor = this.getHistoricalFactor(signal.topic || '');
        strength += historicalFactor * 0.3;
        return Math.min(1, strength);
    }
    calculateSignalVelocity(signal) {
        const existingSignal = Array.from(this.activeSignals.values())
            .find(s => s.topic === signal.topic);
        if (!existingSignal)
            return 1;
        const timeDiff = Date.now() - existingSignal.timestamp;
        const strengthDiff = (signal.strength || 0) - existingSignal.strength;
        return strengthDiff / (timeDiff / 1000); // velocity per second
    }
    isSignificantTrend(signal) {
        return (signal.strength >= this.SIGNAL_THRESHOLD &&
            signal.sources.length >= this.MINIMUM_SOURCES &&
            signal.velocity > 0);
    }
    updateActiveSignals(newSignals) {
        // Remove expired signals
        const now = Date.now();
        for (const [id, signal] of this.activeSignals) {
            if (now - signal.timestamp > this.TREND_TIMEOUT) {
                this.activeSignals.delete(id);
                this.archiveTrend(signal);
            }
        }
        // Add or update new signals
        for (const [id, signal] of newSignals) {
            this.activeSignals.set(id, signal);
        }
        this.emit('signalsUpdated', this.activeSignals);
    }
    archiveTrend(signal) {
        const analysis = this.analyzeTrend(signal);
        this.historicalTrends.set(signal.id, analysis);
        this.emit('trendArchived', { signal, analysis });
    }
    analyzeTrend(signal) {
        return {
            score: signal.strength,
            confidence: signal.sources.length / this.MINIMUM_SOURCES,
            momentum: signal.velocity,
            peakTime: signal.timestamp,
            durability: signal.strength * signal.velocity
        };
    }
    getTrendStage(signalId) {
        const signal = this.activeSignals.get(signalId);
        if (!signal)
            return TrendStage.DEAD;
        const velocity = signal.velocity;
        const age = (Date.now() - signal.timestamp) / this.TREND_TIMEOUT;
        if (age < 0.2 && velocity > 0.8)
            return TrendStage.EMERGING;
        if (age < 0.5 && velocity > 0.5)
            return TrendStage.RISING;
        if (age < 0.7 && velocity > 0.2)
            return TrendStage.PEAKING;
        if (velocity > 0)
            return TrendStage.DECLINING;
        return TrendStage.DEAD;
    }
    getActiveTrends() {
        return new Map(this.activeSignals);
    }
    getTopTrends(limit = 10) {
        return Array.from(this.activeSignals.values())
            .sort((a, b) => b.strength - a.strength)
            .slice(0, limit);
    }
    getRelatedTrends(topic) {
        return Array.from(this.activeSignals.values())
            .filter(signal => signal.topic === topic ||
            signal.relatedTopics.includes(topic));
    }
    getHistoricalFactor(topic) {
        const history = Array.from(this.historicalTrends.values())
            .filter(trend => trend.score > this.SIGNAL_THRESHOLD);
        if (history.length === 0)
            return 0.5;
        const averageScore = history.reduce((acc, trend) => acc + trend.score, 0) / history.length;
        return Math.min(1, averageScore);
    }
    getTrendMetrics(signalId) {
        const signal = this.activeSignals.get(signalId);
        if (!signal) {
            throw new Error(`Trend signal not found: ${signalId}`);
        }
        const stage = this.getTrendStage(signalId);
        const timeToLive = Math.max(0, this.TREND_TIMEOUT - (Date.now() - signal.timestamp));
        const engagement = signal.strength * signal.velocity;
        const potential = this.calculateTrendPotential(signal);
        return {
            stage,
            timeToLive,
            engagement,
            potential
        };
    }
    calculateTrendPotential(signal) {
        const stage = this.getTrendStage(signal.id);
        const historicalFactor = this.getHistoricalFactor(signal.topic);
        const momentumFactor = Math.max(0, Math.min(1, signal.velocity));
        const sourceFactor = Math.min(1, signal.sources.length / (this.MINIMUM_SOURCES * 2));
        let potential = 0;
        switch (stage) {
            case TrendStage.EMERGING:
                potential = 0.8 * historicalFactor + 0.2 * momentumFactor;
                break;
            case TrendStage.RISING:
                potential = 0.6 * momentumFactor + 0.4 * sourceFactor;
                break;
            case TrendStage.PEAKING:
                potential = 0.4 * momentumFactor + 0.6 * sourceFactor;
                break;
            default:
                potential = 0.2 * sourceFactor;
        }
        return Math.min(1, potential);
    }
}
