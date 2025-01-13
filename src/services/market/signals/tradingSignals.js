// src/services/market/signals/tradingSignals.ts
import { EventEmitter } from 'events';
var SignalType;
(function (SignalType) {
    SignalType["TECHNICAL"] = "technical";
    SignalType["FUNDAMENTAL"] = "fundamental";
    SignalType["MOMENTUM"] = "momentum";
    SignalType["VOLATILITY"] = "volatility";
    SignalType["SENTIMENT"] = "sentiment";
})(SignalType || (SignalType = {}));
var SignalTimeframe;
(function (SignalTimeframe) {
    SignalTimeframe["SCALP"] = "scalp";
    SignalTimeframe["INTRADAY"] = "intraday";
    SignalTimeframe["SWING"] = "swing";
    SignalTimeframe["POSITION"] = "position"; // > 7 days
})(SignalTimeframe || (SignalTimeframe = {}));
export class TradingSignalGenerator extends EventEmitter {
    aiService;
    activeSignals;
    CONFIDENCE_THRESHOLD = 0.7;
    SIGNAL_EXPIRY = 3600000; // 1 hour
    MINIMUM_INDICATORS = 3;
    constructor(aiService) {
        super();
        this.aiService = aiService;
        this.activeSignals = new Map();
        this.startSignalMaintenance();
    }
    async generateSignals(marketData, timeframe) {
        try {
            // Generate different types of signals
            const [technicalSignals, fundamentalSignals, momentumSignals, volatilitySignals, sentimentSignals] = await Promise.all([
                this.generateTechnicalSignals(marketData, timeframe),
                this.generateFundamentalSignals(marketData, timeframe),
                this.generateMomentumSignals(marketData, timeframe),
                this.generateVolatilitySignals(marketData, timeframe),
                this.generateSentimentSignals(marketData, timeframe)
            ]);
            // Combine all signals
            const allSignals = [
                ...technicalSignals,
                ...fundamentalSignals,
                ...momentumSignals,
                ...volatilitySignals,
                ...sentimentSignals
            ];
            // Filter and validate signals
            const validSignals = allSignals.filter(signal => this.validateSignal(signal));
            // Update active signals
            validSignals.forEach(signal => {
                this.activeSignals.set(signal.id, signal);
            });
            return validSignals;
        }
        catch (error) {
            console.error('Error generating trading signals:', error);
            throw error;
        }
    }
    async generateTechnicalSignals(marketData, timeframe) {
        const signals = [];
        // Moving Average Signals
        const maSignal = this.analyzeMAs(marketData);
        if (maSignal)
            signals.push(maSignal);
        // RSI Signals
        const rsiSignal = this.analyzeRSI(marketData);
        if (rsiSignal)
            signals.push(rsiSignal);
        // MACD Signals
        const macdSignal = this.analyzeMACD(marketData);
        if (macdSignal)
            signals.push(macdSignal);
        return signals;
    }
    async generateFundamentalSignals(marketData, timeframe) {
        // Implement fundamental signal generation logic
        return [];
    }
    async generateMomentumSignals(marketData, timeframe) {
        // Implement momentum signal generation logic
        return [];
    }
    async generateVolatilitySignals(marketData, timeframe) {
        // Implement volatility signal generation logic
        return [];
    }
    async generateSentimentSignals(marketData, timeframe) {
        // Implement sentiment signal generation logic
        return [];
    }
    analyzeMAs(marketData) {
        const { ma20, ma50, ma200 } = marketData.indicators;
        if (!ma20 || !ma50 || !ma200)
            return null;
        const indicators = [
            {
                name: 'MA20',
                value: ma20,
                weight: 0.4,
                contribution: 0
            },
            {
                name: 'MA50',
                value: ma50,
                weight: 0.3,
                contribution: 0
            },
            {
                name: 'MA200',
                value: ma200,
                weight: 0.3,
                contribution: 0
            }
        ];
        // Calculate contributions
        const currentPrice = marketData.price;
        indicators.forEach(indicator => {
            const diff = (currentPrice - indicator.value) / indicator.value;
            indicator.contribution = diff * indicator.weight;
        });
        const totalContribution = indicators.reduce((sum, ind) => sum + ind.contribution, 0);
        return {
            id: `ma-${Date.now()}`,
            type: SignalType.TECHNICAL,
            action: totalContribution > 0 ? 'buy' : 'sell',
            strength: Math.abs(totalContribution),
            confidence: this.calculateConfidence(indicators),
            timeframe: SignalTimeframe.INTRADAY,
            indicators,
            metadata: {
                price: currentPrice,
                timestamp: Date.now()
            },
            timestamp: Date.now()
        };
    }
    analyzeRSI(marketData) {
        const { rsi } = marketData.indicators;
        if (!rsi)
            return null;
        const indicators = [
            {
                name: 'RSI',
                value: rsi,
                weight: 1,
                contribution: 0
            }
        ];
        // Calculate RSI contribution
        let contribution = 0;
        if (rsi < 30)
            contribution = 1 - (rsi / 30);
        else if (rsi > 70)
            contribution = -((rsi - 70) / 30);
        indicators[0].contribution = contribution;
        return {
            id: `rsi-${Date.now()}`,
            type: SignalType.TECHNICAL,
            action: contribution > 0 ? 'buy' : 'sell',
            strength: Math.abs(contribution),
            confidence: this.calculateConfidence(indicators),
            timeframe: SignalTimeframe.INTRADAY,
            indicators,
            metadata: {
                rsi,
                timestamp: Date.now()
            },
            timestamp: Date.now()
        };
    }
    analyzeMACD(marketData) {
        const { macd, signal, histogram } = marketData.indicators;
        if (!macd || !signal || !histogram)
            return null;
        const indicators = [
            {
                name: 'MACD',
                value: macd,
                weight: 0.4,
                contribution: 0
            },
            {
                name: 'Signal',
                value: signal,
                weight: 0.3,
                contribution: 0
            },
            {
                name: 'Histogram',
                value: histogram,
                weight: 0.3,
                contribution: 0
            }
        ];
        // Calculate contributions
        const macdCrossover = macd - signal;
        indicators[0].contribution = macdCrossover * indicators[0].weight;
        indicators[1].contribution = (histogram > 0 ? 1 : -1) * indicators[1].weight;
        indicators[2].contribution = histogram * indicators[2].weight;
        const totalContribution = indicators.reduce((sum, ind) => sum + ind.contribution, 0);
        return {
            id: `macd-${Date.now()}`,
            type: SignalType.TECHNICAL,
            action: totalContribution > 0 ? 'buy' : 'sell',
            strength: Math.abs(totalContribution),
            confidence: this.calculateConfidence(indicators),
            timeframe: SignalTimeframe.SWING,
            indicators,
            metadata: {
                macd,
                signal,
                histogram,
                timestamp: Date.now()
            },
            timestamp: Date.now()
        };
    }
    calculateConfidence(indicators) {
        if (indicators.length < this.MINIMUM_INDICATORS) {
            return Math.min(0.5, indicators.length / this.MINIMUM_INDICATORS);
        }
        const weightedConfidence = indicators.reduce((sum, ind) => sum + (Math.abs(ind.contribution) * ind.weight), 0);
        return Math.min(1, weightedConfidence);
    }
    validateSignal(signal) {
        return (signal.confidence >= this.CONFIDENCE_THRESHOLD &&
            signal.indicators.length >= this.MINIMUM_INDICATORS &&
            signal.strength > 0);
    }
    startSignalMaintenance() {
        setInterval(() => {
            this.cleanupExpiredSignals();
        }, this.SIGNAL_EXPIRY);
    }
    cleanupExpiredSignals() {
        const now = Date.now();
        for (const [id, signal] of this.activeSignals.entries()) {
            if (now - signal.timestamp > this.SIGNAL_EXPIRY) {
                this.activeSignals.delete(id);
                this.emit('signalExpired', signal);
            }
        }
    }
    getActiveSignals(type, timeframe) {
        let signals = Array.from(this.activeSignals.values());
        if (type) {
            signals = signals.filter(signal => signal.type === type);
        }
        if (timeframe) {
            signals = signals.filter(signal => signal.timeframe === timeframe);
        }
        return signals;
    }
    async validateSignalCombination(signals) {
        try {
            const prompt = this.buildSignalAnalysisPrompt(signals);
            const analysis = await this.aiService.generateResponse({
                content: prompt,
                author: 'system',
                platform: ''
            });
            return JSON.parse(analysis);
        }
        catch (error) {
            console.error('Error validating signal combination:', error);
            return {
                isValid: false,
                confidence: 0,
                recommendation: 'Error validating signals'
            };
        }
    }
    buildSignalAnalysisPrompt(signals) {
        return `
      Analyze the following trading signals:
      ${signals.map(s => `
        Type: ${s.type}
        Action: ${s.action}
        Strength: ${s.strength}
        Confidence: ${s.confidence}
        Timeframe: ${s.timeframe}
      `).join('\n')}

      Provide analysis in JSON format including:
      1. Overall validity (boolean)
      2. Combined confidence score (0-1)
      3. Trading recommendation
    `;
    }
}
