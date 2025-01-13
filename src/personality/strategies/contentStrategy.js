// src/personality/strategies/contentStrategy.ts
import { TraitCategory } from '../traits.js';
import { ResponseType } from '../traits/responsePatterns.js';
import { EventEmitter } from 'events';
var ContentType;
(function (ContentType) {
    ContentType["MEME"] = "meme";
    ContentType["ANALYSIS"] = "analysis";
    ContentType["UPDATE"] = "update";
    ContentType["ENGAGEMENT"] = "engagement";
    ContentType["EDUCATIONAL"] = "educational";
})(ContentType || (ContentType = {}));
export class ContentStrategy extends EventEmitter {
    traitManager;
    memeGenerator;
    responseManager;
    schedule;
    contentHistory;
    MAX_HISTORY_ITEMS = 1000;
    constructor(traitManager, memeGenerator, responseManager) {
        super();
        this.traitManager = traitManager;
        this.memeGenerator = memeGenerator;
        this.responseManager = responseManager;
        this.schedule = new Map();
        this.contentHistory = new Map();
        this.initializeDefaultSchedule();
    }
    initializeDefaultSchedule() {
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
    async generateContent(context) {
        try {
            const schedule = this.getScheduleForTimeSlot(context.timeSlot);
            if (!schedule || !this.checkConditions(schedule.conditions, context)) {
                return this.generateFallbackContent(context);
            }
            const content = await this.generateContentByType(schedule.type, context);
            await this.trackContentMetrics(content, schedule.type);
            return content;
        }
        catch (error) {
            console.error('Error generating content:', error);
            throw error;
        }
    }
    async generateContentByType(type, context) {
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
    async generateMemeContent(context) {
        const generatedMeme = await this.memeGenerator.generateMeme({
            marketCondition: context.marketCondition,
            recentEvents: context.recentEvents,
            communityMood: context.communityMood,
            targetAudience: ['traders', 'holders']
        });
        return generatedMeme.getUrl(); // Assuming the GeneratedMeme object has a 'getUrl' method
    }
    async generateAnalysisContent(context) {
        return await this.responseManager.generateResponse(ResponseType.MARKET_ANALYSIS, {
            platform: context.platform,
            audience: ['traders', 'analysts'],
            marketCondition: context.marketCondition,
            urgency: 0.7,
            previousResponses: []
        }, {
            token: 'SOL',
            pattern: 'trending',
            conclusion: 'analysis pending'
        });
    }
    async generateUpdateContent(context) {
        return await this.responseManager.generateResponse(ResponseType.COMMUNITY_ENGAGEMENT, {
            platform: context.platform,
            audience: ['community', 'holders'],
            marketCondition: context.marketCondition,
            urgency: 0.5,
            previousResponses: []
        }, {
            update: context.recentEvents[0],
            impact: 'positive'
        });
    }
    async generateEngagementContent(context) {
        const traits = this.traitManager.getTraitsByCategory(TraitCategory.SOCIAL);
        const engagementLevel = traits.reduce((acc, trait) => acc + trait.weight, 0) / traits.length;
        return await this.responseManager.generateResponse(ResponseType.COMMUNITY_ENGAGEMENT, {
            platform: context.platform,
            audience: ['community'],
            marketCondition: context.marketCondition,
            urgency: engagementLevel,
            previousResponses: []
        }, {
            topic: 'community',
            mood: context.communityMood
        });
    }
    async generateEducationalContent(context) {
        return await this.responseManager.generateResponse(ResponseType.TECHNICAL_EXPLANATION, {
            platform: context.platform,
            audience: ['newcomers', 'learners'],
            marketCondition: context.marketCondition,
            urgency: 0.3,
            previousResponses: []
        }, {
            topic: 'defi',
            complexity: 'medium'
        });
    }
    async generateFallbackContent(context) {
        // Generate safe, general-purpose content when no schedule matches
        return await this.responseManager.generateResponse(ResponseType.COMMUNITY_ENGAGEMENT, {
            platform: context.platform,
            audience: ['general'],
            marketCondition: context.marketCondition,
            urgency: 0.4,
            previousResponses: []
        }, {
            type: 'general',
            mood: 'neutral'
        });
    }
    checkConditions(conditions, context) {
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
    async trackContentMetrics(content, type) {
        const metrics = {
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
    addScheduleItem(schedule) {
        this.schedule.set(`${schedule.timeSlot}-${schedule.type}`, schedule);
    }
    getScheduleForTimeSlot(timeSlot) {
        return Array.from(this.schedule.values())
            .find(schedule => schedule.timeSlot === timeSlot);
    }
    getContentHistory(type, timeRange) {
        let history = new Map(this.contentHistory);
        if (type) {
            history = new Map(Array.from(history.entries())
                .filter(([key]) => key.startsWith(type)));
        }
        if (timeRange) {
            history = new Map(Array.from(history.entries())
                .filter(([, metrics]) => metrics.timestamp >= timeRange.start &&
                metrics.timestamp <= timeRange.end));
        }
        return history;
    }
    getPerformanceMetrics() {
        const byType = {};
        let overall = {
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
    average(numbers) {
        return numbers.reduce((acc, val) => acc + val, 0) / numbers.length;
    }
}
