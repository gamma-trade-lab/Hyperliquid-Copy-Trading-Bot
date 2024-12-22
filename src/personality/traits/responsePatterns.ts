// src/personality/traits/responsePatterns.ts

import { TraitManager, TraitCategory, PersonalityTrait } from './index';
import { EventEmitter } from 'events';

// Response types for different contexts
export enum ResponseType {
  MARKET_ANALYSIS = 'market_analysis',
  COMMUNITY_ENGAGEMENT = 'community_engagement',
  MEME_RESPONSE = 'meme_response',
  TECHNICAL_EXPLANATION = 'technical_explanation',
  PRICE_PREDICTION = 'price_prediction',
  TRADING_STRATEGY = 'trading_strategy',
  TREND_COMMENTARY = 'trend_commentary'
}

// Platform-specific formatting
export enum Platform {
  TWITTER = 'twitter',
  DISCORD = 'discord',
  TELEGRAM = 'telegram',
  FARCASTER = 'farcaster'
}

interface ResponsePattern {
  id: string;
  type: ResponseType;
  templates: string[];
  variables: string[];
  tone: string;
  minLength: number;
  maxLength: number;
  requiredTraits: string[];
  platformSpecifics: Map<Platform, PlatformConfig>;
  successRate?: number;
}

interface PlatformConfig {
  maxLength: number;
  formatting: string[];
  allowedFeatures: string[];
  restrictions: string[];
}

interface ResponseContext {
  platform: Platform;
  audience: string[];
  marketCondition: 'bullish' | 'bearish' | 'neutral';
  urgency: number;
  previousResponses: string[];
  engagementMetrics?: {
    likes: number;
    replies: number;
    reposts: number;
  };
}

export class ResponsePatternManager extends EventEmitter {
  private traitManager: TraitManager;
  private patterns: Map<string, ResponsePattern>;
  private recentResponses: Array<{
    pattern: ResponsePattern;
    response: string;
    metrics?: any;
    timestamp: number;
  }>;
  private readonly MAX_RECENT_RESPONSES = 100;

  constructor(traitManager: TraitManager) {
    super();
    this.traitManager = traitManager;
    this.patterns = new Map();
    this.recentResponses = [];
    this.initializeDefaultPatterns();
  }

  private initializeDefaultPatterns(): void {
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

  public async generateResponse(
    type: ResponseType,
    context: ResponseContext,
    data: Record<string, any>
  ): Promise<string> {
    const pattern = this.selectBestPattern(type, context);
    const traits = this.getRelevantTraits(pattern);
    
    return this.constructResponse(pattern, context, data, traits);
  }

  private selectBestPattern(
    type: ResponseType,
    context: ResponseContext
  ): ResponsePattern {
    const eligiblePatterns = Array.from(this.patterns.values())
      .filter(pattern => pattern.type === type)
      .filter(pattern => this.isPatternEligible(pattern, context));

    return this.rankPatterns(eligiblePatterns, context)[0];
  }

  private isPatternEligible(
    pattern: ResponsePattern,
    context: ResponseContext
  ): boolean {
    const platformConfig = pattern.platformSpecifics.get(context.platform);
    if (!platformConfig) return false;

    // Check all required traits are present
    const hasRequiredTraits = pattern.requiredTraits.every(traitId => 
      this.traitManager.getTrait(traitId)?.active
    );

    // Check platform-specific restrictions
    const meetsRestrictions = platformConfig.restrictions.every(restriction =>
      this.checkRestriction(restriction, context)
    );

    return hasRequiredTraits && meetsRestrictions;
  }

  private rankPatterns(
    patterns: ResponsePattern[],
    context: ResponseContext
  ): ResponsePattern[] {
    return patterns.sort((a, b) => {
      const scoreA = this.calculatePatternScore(a, context);
      const scoreB = this.calculatePatternScore(b, context);
      return scoreB - scoreA;
    });
  }

  private calculatePatternScore(
    pattern: ResponsePattern,
    context: ResponseContext
  ): number {
    const baseScore = pattern.successRate || 0.5;
    const recencyPenalty = this.calculateRecencyPenalty(pattern);
    const contextScore = this.calculateContextScore(pattern, context);
    const traitScore = this.calculateTraitScore(pattern);

    return (
      baseScore * 0.4 +
      (1 - recencyPenalty) * 0.2 +
      contextScore * 0.2 +
      traitScore * 0.2
    );
  }

  private calculateRecencyPenalty(pattern: ResponsePattern): number {
    const recentUse = this.recentResponses.find(r => r.pattern.id === pattern.id);
    if (!recentUse) return 0;

    const hoursSinceUse = (Date.now() - recentUse.timestamp) / (1000 * 60 * 60);
    return Math.max(0, 1 - hoursSinceUse / 24); // Penalty decreases over 24 hours
  }

  private calculateContextScore(
    pattern: ResponsePattern,
    context: ResponseContext
  ): number {
    let score = 0;

    // Check audience alignment
    const audienceMatch = pattern.variables.some(v => 
      context.audience.includes(v)
    );
    if (audienceMatch) score += 0.3;

    // Check market condition alignment
    if (pattern.type === ResponseType.MARKET_ANALYSIS) {
      score += context.marketCondition === 'bullish' ? 0.4 : 0.2;
    }

    // Check engagement metrics if available
    if (context.engagementMetrics) {
      const totalEngagement = 
        context.engagementMetrics.likes +
        context.engagementMetrics.replies * 2 +
        context.engagementMetrics.reposts * 3;
      score += Math.min(0.3, totalEngagement / 1000);
    }

    return score;
  }

  private calculateTraitScore(pattern: ResponsePattern): number {
    const traits = pattern.requiredTraits.map(id => 
      this.traitManager.getTrait(id)
    ).filter((t): t is PersonalityTrait => t !== undefined);

    if (traits.length === 0) return 0;

    return traits.reduce((acc, trait) => acc + trait.weight, 0) / traits.length;
  }

  private async constructResponse(
    pattern: ResponsePattern,
    context: ResponseContext,
    data: Record<string, any>,
    traits: PersonalityTrait[]
  ): Promise<string> {
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

  private selectTemplate(
    pattern: ResponsePattern,
    context: ResponseContext
  ): string {
    // Weight templates by success rate and context
    return pattern.templates[Math.floor(Math.random() * pattern.templates.length)];
  }

  private fillTemplate(
    template: string,
    data: Record<string, any>
  ): string {
    return template.replace(
      /{(\w+)}/g,
      (match, key) => data[key]?.toString() || match
    );
  }

  private applyTraitModifications(
    response: string,
    traits: PersonalityTrait[]
  ): string {
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

  private formatForPlatform(
    response: string,
    platform: Platform
  ): string {
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

  private getPlatformConfig(platform: Platform): PlatformConfig {
    return {
      maxLength: platform === Platform.TWITTER ? 280 : 2000,
      formatting: ['plain'],
      allowedFeatures: [],
      restrictions: []
    };
  }

  private formatForTwitter(
    response: string,
    config: PlatformConfig
  ): string {
    // Add hashtags if within length
    if (response.length + 20 <= config.maxLength) {
      response += '\n\n#crypto #defi';
    }
    return response;
  }

  private formatForDiscord(
    response: string,
    config: PlatformConfig
  ): string {
    // Add markdown formatting
    return `**${response}**`;
  }

  private validateAndAdjustLength(
    response: string,
    platform: Platform
  ): string {
    const config = this.getPlatformConfig(platform);
    
    if (response.length > config.maxLength) {
      return response.slice(0, config.maxLength - 3) + '...';
    }
    
    return response;
  }

  public addPattern(pattern: ResponsePattern): void {
    this.patterns.set(pattern.id, pattern);
    this.emit('patternAdded', pattern);
  }

  public getPattern(id: string): ResponsePattern | undefined {
    return this.patterns.get(id);
  }

  private getRelevantTraits(pattern: ResponsePattern): PersonalityTrait[] {
    return pattern.requiredTraits
      .map(id => this.traitManager.getTrait(id))
      .filter((t): t is PersonalityTrait => t !== undefined);
  }

  private addMemeFlavor(response: string, weight: number): string {
    // Add emojis and meme-specific modifications based on weight
    return response;
  }

  private addTechnicalPrecision(response: string, weight: number): string {
    // Add technical terms and precise language based on weight
    return response;
  }

  private checkRestriction(
    restriction: string,
    context: ResponseContext
  ): boolean {
    // Implement restriction checking logic
    return true;
  }
}