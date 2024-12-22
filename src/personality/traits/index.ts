// src/personality/traits/index.ts

import { EventEmitter } from 'events';

// Core trait types
export enum TraitCategory {
  SOCIAL = 'social',
  MARKET = 'market',
  COMMUNITY = 'community',
  MEME = 'meme',
  TECHNICAL = 'technical'
}

export enum TraitInfluence {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface TraitParameter {
  name: string;
  value: number;
  min: number;
  max: number;
  description: string;
}

export interface PersonalityTrait {
  id: string;
  name: string;
  category: TraitCategory;
  weight: number;
  influence: TraitInfluence;
  active: boolean;
  parameters: TraitParameter[];
  metadata?: Record<string, any>;
}

// Trait modifiers for different contexts
export interface TraitModifier {
  condition: string;
  weightMultiplier: number;
  duration: number; // in milliseconds
}

// Trait manager class
export class TraitManager extends EventEmitter {
  private traits: Map<string, PersonalityTrait>;
  private activeModifiers: Map<string, TraitModifier[]>;

  constructor() {
    super();
    this.traits = new Map();
    this.activeModifiers = new Map();
    this.initializeDefaultTraits();
  }

  private initializeDefaultTraits(): void {
    // Meme-focused traits
    this.addTrait({
      id: 'meme-creativity',
      name: 'Meme Creativity',
      category: TraitCategory.MEME,
      weight: 0.8,
      influence: TraitInfluence.HIGH,
      active: true,
      parameters: [
        {
          name: 'humorLevel',
          value: 0.7,
          min: 0,
          max: 1,
          description: 'Determines how humorous the content should be'
        },
        {
          name: 'viralPotential',
          value: 0.8,
          min: 0,
          max: 1,
          description: 'Affects likelihood of content going viral'
        }
      ]
    });

    // Market analysis traits
    this.addTrait({
      id: 'market-awareness',
      name: 'Market Awareness',
      category: TraitCategory.MARKET,
      weight: 0.7,
      influence: TraitInfluence.HIGH,
      active: true,
      parameters: [
        {
          name: 'trendSensitivity',
          value: 0.8,
          min: 0,
          max: 1,
          description: 'Sensitivity to market trends'
        },
        {
          name: 'riskTolerance',
          value: 0.6,
          min: 0,
          max: 1,
          description: 'Tolerance for market risk'
        }
      ]
    });

    // Social engagement traits
    this.addTrait({
      id: 'community-engagement',
      name: 'Community Engagement',
      category: TraitCategory.COMMUNITY,
      weight: 0.75,
      influence: TraitInfluence.HIGH,
      active: true,
      parameters: [
        {
          name: 'responseRate',
          value: 0.9,
          min: 0,
          max: 1,
          description: 'Frequency of community interaction'
        },
        {
          name: 'empathyLevel',
          value: 0.7,
          min: 0,
          max: 1,
          description: 'Level of emotional intelligence in responses'
        }
      ]
    });
  }

  public addTrait(trait: PersonalityTrait): void {
    this.traits.set(trait.id, trait);
    this.emit('traitAdded', trait);
  }

  public getTrait(id: string): PersonalityTrait | undefined {
    return this.traits.get(id);
  }

  public getAllTraits(): PersonalityTrait[] {
    return Array.from(this.traits.values());
  }

  public getTraitsByCategory(category: TraitCategory): PersonalityTrait[] {
    return this.getAllTraits().filter(trait => trait.category === category);
  }

  public updateTraitWeight(id: string, weight: number): void {
    const trait = this.traits.get(id);
    if (trait) {
      trait.weight = Math.max(0, Math.min(1, weight));
      this.emit('traitUpdated', trait);
    }
  }

  public updateTraitParameter(
    traitId: string,
    parameterName: string,
    value: number
  ): void {
    const trait = this.traits.get(traitId);
    if (trait) {
      const parameter = trait.parameters.find(p => p.name === parameterName);
      if (parameter) {
        parameter.value = Math.max(parameter.min, Math.min(parameter.max, value));
        this.emit('parameterUpdated', { trait, parameter });
      }
    }
  }

  public addModifier(traitId: string, modifier: TraitModifier): void {
    const modifiers = this.activeModifiers.get(traitId) || [];
    modifiers.push(modifier);
    this.activeModifiers.set(traitId, modifiers);
    
    // Set timeout to remove the modifier after duration
    setTimeout(() => {
      this.removeModifier(traitId, modifier);
    }, modifier.duration);

    this.emit('modifierAdded', { traitId, modifier });
  }

  public removeModifier(traitId: string, modifier: TraitModifier): void {
    const modifiers = this.activeModifiers.get(traitId) || [];
    const index = modifiers.indexOf(modifier);
    if (index > -1) {
      modifiers.splice(index, 1);
      if (modifiers.length === 0) {
        this.activeModifiers.delete(traitId);
      } else {
        this.activeModifiers.set(traitId, modifiers);
      }
      this.emit('modifierRemoved', { traitId, modifier });
    }
  }

  public getEffectiveWeight(traitId: string): number {
    const trait = this.traits.get(traitId);
    if (!trait) return 0;

    const modifiers = this.activeModifiers.get(traitId) || [];
    let weight = trait.weight;

    // Apply all active modifiers
    modifiers.forEach(modifier => {
      weight *= modifier.weightMultiplier;
    });

    return Math.max(0, Math.min(1, weight));
  }

  public getTraitInfluence(context: Record<string, any>): Record<string, number> {
    const influence: Record<string, number> = {};
    
    this.getAllTraits().forEach(trait => {
      if (trait.active) {
        const effectiveWeight = this.getEffectiveWeight(trait.id);
        influence[trait.id] = this.calculateContextualInfluence(
          trait,
          effectiveWeight,
          context
        );
      }
    });

    return influence;
  }

  private calculateContextualInfluence(
    trait: PersonalityTrait,
    weight: number,
    context: Record<string, any>
  ): number {
    // Base influence calculation
    let influence = weight;

    // Adjust based on trait category and context
    switch (trait.category) {
      case TraitCategory.MEME:
        influence *= context.memeRelevance || 1;
        break;
      case TraitCategory.MARKET:
        influence *= context.marketVolatility || 1;
        break;
      case TraitCategory.COMMUNITY:
        influence *= context.communityActivity || 1;
        break;
      default:
        break;
    }

    return Math.max(0, Math.min(1, influence));
  }
}

// Export default instance
export const traitManager = new TraitManager();

// Export helper functions
export function createTrait(
  name: string,
  category: TraitCategory,
  weight: number,
  parameters: TraitParameter[]
): PersonalityTrait {
  return {
    id: `${category}-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    category,
    weight,
    influence: TraitInfluence.MEDIUM,
    active: true,
    parameters
  };
}

export function createParameter(
  name: string,
  value: number,
  min: number,
  max: number,
  description: string
): TraitParameter {
  return {
    name,
    value: Math.max(min, Math.min(max, value)),
    min,
    max,
    description
  };
}