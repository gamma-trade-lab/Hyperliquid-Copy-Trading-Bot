// src/personality/traits/responsePatterns.ts
import { TraitCategory } from './index.js';
import { EventEmitter } from 'events';
// Response types for different contexts
export var ResponseType;
(function (ResponseType) {
    ResponseType["MARKET_ANALYSIS"] = "market_analysis";
    ResponseType["COMMUNITY_ENGAGEMENT"] = "community_engagement";
    ResponseType["MEME_RESPONSE"] = "meme_response";
    ResponseType["TECHNICAL_EXPLANATION"] = "technical_explanation";
    ResponseType["PRICE_PREDICTION"] = "price_prediction";
    ResponseType["TRADING_STRATEGY"] = "trading_strategy";
    ResponseType["TREND_COMMENTARY"] = "trend_commentary";
})(ResponseType || (ResponseType = {}));
// Platform-specific formatting
export var Platform;
(function (Platform) {
    Platform["TWITTER"] = "twitter";
    Platform["DISCORD"] = "discord";
    Platform["TELEGRAM"] = "telegram";
    Platform["FARCASTER"] = "farcaster";
})(Platform || (Platform = {}));
export class ResponsePatternManager extends EventEmitter {
    traitManager;
    patterns;
    recentResponses;
    MAX_RECENT_RESPONSES = 100;
    constructor(traitManager) {
        super();
        this.traitManager = traitManager;
        this.patterns = new Map();
        this.recentResponses = [];
        this.initializeDefaultPatterns();
    }
    initializeDefaultPatterns() {
        // Market Analysis Patterns
        this.addPattern({
            id: 'market-analysis-basic',
            type: ResponseType.MARKET_ANALYSIS,
            templates: [
                "Looking at {token}'s movement, we're seeing {pattern}. This suggests {conclusion}.",
                "Market analysis: {token} is showing {pattern}. My take: {conclusion}."
            ],
            variables: ['token', 'pattern', 'conclusion'],
            tone: 'analytical',
            minLength: 100,
            maxLength: 280,
            requiredTraits: ['market-awareness', 'technical-analysis'],
            platformSpecifics: new Map([
                [Platform.TWITTER, {
                        maxLength: 280,
                        formatting: ['plain', 'bold'],
                        allowedFeatures: ['links', 'mentions', 'hashtags'],
                        restrictions: ['no_threads']
                    }],
                [Platform.DISCORD, {
                        maxLength: 2000,
                        formatting: ['markdown', 'embeds'],
                        allowedFeatures: ['embeds', 'reactions'],
                        restrictions: []
                    }]
            ])
        });
        // Community Engagement Patterns
        this.addPattern({
            id: 'community-hype',
            type: ResponseType.COMMUNITY_ENGAGEMENT,
            templates: [
                "GM {community}! Ready for another day of {activity}? 🚀",
                "Incredible energy from the {community} today! Let's {activity} together! 🔥"
            ],
            variables: ['community', 'activity'],
            tone: 'enthusiastic',
            minLength: 50,
            maxLength: 200,
            requiredTraits: ['community-engagement', 'meme-creativity'],
            platformSpecifics: new Map([
                [Platform.TWITTER, {
                        maxLength: 280,
                        formatting: ['emojis'],
                        allowedFeatures: ['mentions', 'hashtags'],
                        restrictions: ['no_spam']
                    }]
            ])
        });
    }
    async generateResponse(type, context, data) {
        const pattern = this.selectBestPattern(type, context);
        const traits = this.getRelevantTraits(pattern);
        return this.constructResponse(pattern, context, data, traits);
    }
    selectBestPattern(type, context) {
        const eligiblePatterns = Array.from(this.patterns.values())
            .filter(pattern => pattern.type === type)
            .filter(pattern => this.isPatternEligible(pattern, context));
        return this.rankPatterns(eligiblePatterns, context)[0];
    }
    isPatternEligible(pattern, context) {
        const platformConfig = pattern.platformSpecifics.get(context.platform);
        if (!platformConfig)
            return false;
        // Check all required traits are present
        const hasRequiredTraits = pattern.requiredTraits.every(traitId => this.traitManager.getTrait(traitId)?.active);
        // Check platform-specific restrictions
        const meetsRestrictions = platformConfig.restrictions.every(restriction => this.checkRestriction(restriction, context));
        return hasRequiredTraits && meetsRestrictions;
    }
    rankPatterns(patterns, context) {
        return patterns.sort((a, b) => {
            const scoreA = this.calculatePatternScore(a, context);
            const scoreB = this.calculatePatternScore(b, context);
            return scoreB - scoreA;
        });
    }
    calculatePatternScore(pattern, context) {
        const baseScore = pattern.successRate || 0.5;
        const recencyPenalty = this.calculateRecencyPenalty(pattern);
        const contextScore = this.calculateContextScore(pattern, context);
        const traitScore = this.calculateTraitScore(pattern);
        return (baseScore * 0.4 +
            (1 - recencyPenalty) * 0.2 +
            contextScore * 0.2 +
            traitScore * 0.2);
    }
    calculateRecencyPenalty(pattern) {
        const recentUse = this.recentResponses.find(r => r.pattern.id === pattern.id);
        if (!recentUse)
            return 0;
        const hoursSinceUse = (Date.now() - recentUse.timestamp) / (1000 * 60 * 60);
        return Math.max(0, 1 - hoursSinceUse / 24); // Penalty decreases over 24 hours
    }
    calculateContextScore(pattern, context) {
        let score = 0;
        // Check audience alignment
        const audienceMatch = pattern.variables.some(v => context.audience.includes(v));
        if (audienceMatch)
            score += 0.3;
        // Check market condition alignment
        if (pattern.type === ResponseType.MARKET_ANALYSIS) {
            score += context.marketCondition === 'bullish' ? 0.4 : 0.2;
        }
        // Check engagement metrics if available
        if (context.engagementMetrics) {
            const totalEngagement = context.engagementMetrics.likes +
                context.engagementMetrics.replies * 2 +
                context.engagementMetrics.reposts * 3;
            score += Math.min(0.3, totalEngagement / 1000);
        }
        return score;
    }
    calculateTraitScore(pattern) {
        const traits = pattern.requiredTraits.map(id => this.traitManager.getTrait(id)).filter((t) => t !== undefined);
        if (traits.length === 0)
            return 0;
        return traits.reduce((acc, trait) => acc + trait.weight, 0) / traits.length;
    }
    async constructResponse(pattern, context, data, traits) {
        // Select template based on context
        const template = this.selectTemplate(pattern, context);
        // Fill in variables
        let response = this.fillTemplate(template, data);
        // Apply trait modifications
        response = this.applyTraitModifications(response, traits);
        // Format for platform
        response = this.formatForPlatform(response, context.platform);
        // Validate and adjust length
        response = this.validateAndAdjustLength(response, context.platform);
        return response;
    }
    selectTemplate(pattern, context) {
        // Weight templates by success rate and context
        return pattern.templates[Math.floor(Math.random() * pattern.templates.length)];
    }
    fillTemplate(template, data) {
        return template.replace(/{(\w+)}/g, (match, key) => data[key]?.toString() || match);
    }
    applyTraitModifications(response, traits) {
        traits.forEach(trait => {
            // Apply trait-specific modifications
            switch (trait.category) {
                case TraitCategory.MEME:
                    response = this.addMemeFlavor(response, trait.weight);
                    break;
                case TraitCategory.TECHNICAL:
                    response = this.addTechnicalPrecision(response, trait.weight);
                    break;
                default:
                    break;
            }
        });
        return response;
    }
    formatForPlatform(response, platform) {
        const config = this.getPlatformConfig(platform);
        switch (platform) {
            case Platform.TWITTER:
                return this.formatForTwitter(response, config);
            case Platform.DISCORD:
                return this.formatForDiscord(response, config);
            default:
                return response;
        }
    }
    getPlatformConfig(platform) {
        return {
            maxLength: platform === Platform.TWITTER ? 280 : 2000,
            formatting: ['plain'],
            allowedFeatures: [],
            restrictions: []
        };
    }
    formatForTwitter(response, config) {
        // Add hashtags if within length
        if (response.length + 20 <= config.maxLength) {
            response += '\n\n#crypto #defi';
        }
        return response;
    }
    formatForDiscord(response, config) {
        // Add markdown formatting
        return `**${response}**`;
    }
    validateAndAdjustLength(response, platform) {
        const config = this.getPlatformConfig(platform);
        if (response.length > config.maxLength) {
            return response.slice(0, config.maxLength - 3) + '...';
        }
        return response;
    }
    addPattern(pattern) {
        this.patterns.set(pattern.id, pattern);
        this.emit('patternAdded', pattern);
    }
    getPattern(id) {
        return this.patterns.get(id);
    }
    getRelevantTraits(pattern) {
        return pattern.requiredTraits
            .map(id => this.traitManager.getTrait(id))
            .filter((t) => t !== undefined);
    }
    addMemeFlavor(response, weight) {
        // Add emojis and meme-specific modifications based on weight
        return response;
    }
    addTechnicalPrecision(response, weight) {
        // Add technical terms and precise language based on weight
        return response;
    }
    checkRestriction(restriction, context) {
        // Implement restriction checking logic
        return true;
    }
}
