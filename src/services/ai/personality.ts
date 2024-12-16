// src/services/ai/personality.ts

import { personalityConfig } from '../../config/personality';
import { MarketAction } from '../../config/constants';

// Add missing enums
export enum SentimentLevel {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral'
}

export enum MarketCondition {
  BULLISH = 'bullish',
  BEARISH = 'bearish',
  NEUTRAL = 'neutral'
}

interface PersonalityContext {
  marketCondition: MarketCondition;
  sentiment: SentimentLevel;
  communityMetrics?: {
    engagement: number;
    sentiment: number;
    growth: number;
  };
  recentEvents?: string[];
}

interface ResponseOptions {
  type: 'market' | 'community' | 'trading' | 'meme';
  intensity?: number;  // 0-1, affects response style
  formality?: number; // 0-1, affects language choice
}

export class PersonalityService {
  private config: typeof personalityConfig;
  private currentMood: SentimentLevel;
  private recentResponses: string[] = [];

  constructor() {
    this.config = personalityConfig;
    this.currentMood = SentimentLevel.NEUTRAL;
  }

  generateResponse(
    context: PersonalityContext,
    options: ResponseOptions
  ): string {
    this.updateMood(context);
    const template = this.selectTemplate(context, options);
    return this.fillTemplate(template, context, options);
  }

  adaptPersonality(metrics: {
    engagement: number;
    sentiment: number;
    effectiveness: number;
  }): void {
    this.config.core.baseTraits = this.config.core.baseTraits.map(trait => ({
      ...trait,
      weight: this.adjustTraitWeight(trait.weight, metrics)
    }));

    if (metrics.engagement < 0.5) {
      this.config.core.voice.style = "more engaging and dynamic";
    }

    this.saveAdaptations();
  }

  private selectTemplate(
    context: PersonalityContext,
    options: ResponseOptions
  ): string {
    const { type, intensity = 0.5 } = options;

    switch (type) {
      case 'market':
        return this.getMarketTemplate(context.marketCondition, intensity);
      case 'community':
        return this.getCommunityTemplate(context.sentiment, intensity);
      case 'trading':
        return this.getTradingTemplate(context.marketCondition);
      case 'meme':
        return this.getMemeTemplate(context);
      default:
        return this.getDefaultTemplate();
    }
  }

  private getMarketTemplate(
    condition: MarketCondition,
    intensity: number
  ): string {
    const templates = this.config.responses.marketAnalysis;
    const matchingTemplates = templates.filter(t => 
      t.conditions?.marketCondition === condition
    );

    if (matchingTemplates.length === 0) {
      return templates[0].templates[0];
    }

    const templateIndex = Math.floor(intensity * matchingTemplates.length);
    return matchingTemplates[templateIndex].templates[0];
  }

  private getCommunityTemplate(
    sentiment: SentimentLevel,
    intensity: number
  ): string {
    const templates = this.config.responses.communityEngagement;
    return templates[0].templates[0]; // Simplified for example
  }

  private getTradingTemplate(condition: MarketCondition): string {
    const templates = this.config.responses.tradingSignals;
    return templates[0].templates[0]; // Simplified for example
  }

  private getMemeTemplate(context: PersonalityContext): string {
    const templates = this.config.responses.memeContent;
    return templates[0].templates[0]; // Simplified for example
  }

  private getDefaultTemplate(): string {
    return this.config.responses.marketAnalysis[0].templates[0];
  }

  private fillTemplate(
    template: string,
    context: PersonalityContext,
    options: ResponseOptions
  ): string {
    let response = template;

    response = response.replace('{market_condition}', context.marketCondition);
    response = response.replace('{sentiment}', context.sentiment);
    response = this.addPersonalityMarkers(response, options);
    response = this.addCryptoVocabulary(response, context);

    if (this.recentResponses.includes(response)) {
      response = this.makeResponseUnique(response);
    }

    this.updateResponseCache(response);
    return response;
  }

  private makeResponseFormal(response: string): string {
    // Implement formal language transformation
    return response.replace(/gonna/g, "going to")
                  .replace(/wanna/g, "want to");
  }

  private makeResponseCasual(response: string): string {
    // Implement casual language transformation
    return response.replace(/going to/g, "gonna")
                  .replace(/want to/g, "wanna");
  }

  private addPersonalityMarkers(response: string, options: ResponseOptions): string {
    const { formality = 0.5 } = options;
    
    if (formality > 0.7) {
      return this.makeResponseFormal(response);
    } else if (formality < 0.3) {
      return this.makeResponseCasual(response);
    }
    
    return response;
  }

  private addCryptoVocabulary(response: string, context: PersonalityContext): string {
    const vocabulary = this.config.core.voice.vocabulary;
    
    if (context.marketCondition === MarketCondition.BULLISH) {
      response = response.replace(
        /\b(good|positive|up)\b/gi,
        () => vocabulary.filter(term => term.includes('bull'))[0] || 'bullish'
      );
    }

    return response;
  }

  private makeResponseUnique(response: string): string {
    const defaultTemplates = this.config.responses.marketAnalysis[0].templates;
    const alternativeTemplate = defaultTemplates[Math.floor(Math.random() * defaultTemplates.length)];
    return alternativeTemplate || response;
  }

  private updateResponseCache(response: string): void {
    this.recentResponses.push(response);
    if (this.recentResponses.length > 10) {
      this.recentResponses.shift();
    }
  }

  private updateMood(context: PersonalityContext): void {
    const marketImpact = this.calculateMarketImpact(context.marketCondition);
    const sentimentImpact = context.communityMetrics?.sentiment || 0;
    const moodScore = (marketImpact + sentimentImpact) / 2;
    this.currentMood = this.getMoodFromScore(moodScore);
  }

  private calculateMarketImpact(condition: MarketCondition): number {
    switch (condition) {
      case MarketCondition.BULLISH:
        return 0.8;
      case MarketCondition.BEARISH:
        return 0.2;
      default:
        return 0.5;
    }
  }

  private getMoodFromScore(score: number): SentimentLevel {
    if (score > 0.6) return SentimentLevel.POSITIVE;
    if (score < 0.4) return SentimentLevel.NEGATIVE;
    return SentimentLevel.NEUTRAL;
  }

  private adjustTraitWeight(
    currentWeight: number,
    metrics: { engagement: number; effectiveness: number }
  ): number {
    const adjustment = (metrics.engagement + metrics.effectiveness) / 2 - 0.5;
    return Math.max(0, Math.min(1, currentWeight + adjustment * 0.1));
  }

  private saveAdaptations(): void {
    // Implementation for saving adaptations
    // Add your storage logic here
  }

  getPersonalityState() {
    return {
      mood: this.currentMood,
      traits: this.config.core.baseTraits,
      recentResponses: this.recentResponses
    };
  }
}