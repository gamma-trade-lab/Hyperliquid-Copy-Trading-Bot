import { MarketAction } from '../../config/constants';
import { MarketCondition } from '../ai/personality';
import * as natural from 'natural'; // Assuming you are using the 'natural' library for NLP

interface SentimentConfig {
    windowSize: number;  // Number of data points to analyze
    updateInterval: number;  // Milliseconds between updates
    thresholds: {
        positive: number;
        negative: number;
    };
}

interface SentimentData {
    text: string;
    timestamp: number;
    platform: string;
    influence?: number;  // 0-1 based on user influence
}

interface SentimentAnalysis {
    score: number;  // -1 to 1
    confidence: number;
    marketSentiment: MarketCondition;
    topTopics: string[];
    keyPhrases: string[];
    trends: {
        shortTerm: MarketCondition;
        longTerm: MarketCondition;
    };
}

export class SentimentService {
    private config: SentimentConfig;
    private recentData: SentimentData[] = [];
    private currentAnalysis: SentimentAnalysis;
    private intervalId?: NodeJS.Timer;

    constructor(config: SentimentConfig) {
        this.config = config;
        this.currentAnalysis = this.initializeAnalysis();
    }

    async startAnalysis(): Promise<void> {
        await this.updateAnalysis();
        this.intervalId = setInterval(
            () => this.updateAnalysis(),
            this.config.updateInterval
        );
    }

    stopAnalysis(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId as NodeJS.Timeout);
        }
    }

    async addData(data: SentimentData): Promise<void> {
        this.recentData.push(data);
        if (this.recentData.length > this.config.windowSize) {
            this.recentData.shift();
        }
        await this.updateAnalysis();
    }

    async getCurrentSentiment(): Promise<SentimentAnalysis> {
        return this.currentAnalysis;
    }

    private async updateAnalysis(): Promise<void> {
        try {
            const textAnalysis = await this.analyzeSentimentText();
            const marketAnalysis = await this.analyzeMarketSentiment();
            const trends = await this.analyzeTrends();

            this.currentAnalysis = {
                ...textAnalysis,
                ...marketAnalysis,
                trends
            };
        } catch (error) {
            console.error('Error updating sentiment analysis:', error);
        }
    }

    private async analyzeSentimentText() {
        const texts = this.recentData.map(data => data.text);
        const analyzer = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
        const tokenizer = new natural.WordTokenizer();

        let totalScore = 0;
        let totalConfidence = 0;
        const keyPhrases: string[] = [];
        const topTopics: string[] = [];

        texts.forEach(text => {
            const tokens = tokenizer.tokenize(text);
            const score = analyzer.getSentiment(tokens);
            totalScore += score;
            totalConfidence += Math.abs(score);

            // Extract key phrases and topics (simple example)
            keyPhrases.push(...tokens.filter(token => token.length > 4));
            topTopics.push(...tokens.filter(token => token.length > 6));
        });

        const averageScore = totalScore / texts.length;
        const averageConfidence = totalConfidence / texts.length;

        return {
            score: averageScore,
            confidence: averageConfidence,
            topTopics: Array.from(new Set(topTopics)),
            keyPhrases: Array.from(new Set(keyPhrases))
        };
    }

    private async analyzeMarketSentiment() {
        const averageScore = this.currentAnalysis.score;
        let marketSentiment = MarketCondition.NEUTRAL;

        if (averageScore > this.config.thresholds.positive) {
            marketSentiment = MarketCondition.BULLISH;
        } else if (averageScore < this.config.thresholds.negative) {
            marketSentiment = MarketCondition.BEARISH;
        }

        return {
            marketSentiment
        };
    }

    private async analyzeTrends() {
        // Implement trend analysis based on historical data
        // For simplicity, we assume trends are neutral
        return {
            shortTerm: MarketCondition.NEUTRAL,
            longTerm: MarketCondition.NEUTRAL
        };
    }

    private initializeAnalysis(): SentimentAnalysis {
        return {
            score: 0,
            confidence: 0,
            marketSentiment: MarketCondition.NEUTRAL,
            topTopics: [],
            keyPhrases: [],
            trends: {
                shortTerm: MarketCondition.NEUTRAL,
                longTerm: MarketCondition.NEUTRAL
            }
        };
    }
}