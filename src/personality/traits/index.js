// src/personality/traits/index.ts
import { EventEmitter } from 'events';
// Core trait types
export var TraitCategory;
(function (TraitCategory) {
    TraitCategory["SOCIAL"] = "social";
    TraitCategory["MARKET"] = "market";
    TraitCategory["COMMUNITY"] = "community";
    TraitCategory["MEME"] = "meme";
    TraitCategory["TECHNICAL"] = "technical";
})(TraitCategory || (TraitCategory = {}));
export var TraitInfluence;
(function (TraitInfluence) {
    TraitInfluence["HIGH"] = "high";
    TraitInfluence["MEDIUM"] = "medium";
    TraitInfluence["LOW"] = "low";
})(TraitInfluence || (TraitInfluence = {}));
// Trait manager class
export class TraitManager extends EventEmitter {
    traits;
    activeModifiers;
    constructor() {
        super();
        this.traits = new Map();
        this.activeModifiers = new Map();
        this.initializeDefaultTraits();
    }
    initializeDefaultTraits() {
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
    addTrait(trait) {
        this.traits.set(trait.id, trait);
        this.emit('traitAdded', trait);
    }
    getTrait(id) {
        return this.traits.get(id);
    }
    getAllTraits() {
        return Array.from(this.traits.values());
    }
    getTraitsByCategory(category) {
        return this.getAllTraits().filter(trait => trait.category === category);
    }
    updateTraitWeight(id, weight) {
        const trait = this.traits.get(id);
        if (trait) {
            trait.weight = Math.max(0, Math.min(1, weight));
            this.emit('traitUpdated', trait);
        }
    }
    updateTraitParameter(traitId, parameterName, value) {
        const trait = this.traits.get(traitId);
        if (trait) {
            const parameter = trait.parameters.find(p => p.name === parameterName);
            if (parameter) {
                parameter.value = Math.max(parameter.min, Math.min(parameter.max, value));
                this.emit('parameterUpdated', { trait, parameter });
            }
        }
    }
    addModifier(traitId, modifier) {
        const modifiers = this.activeModifiers.get(traitId) || [];
        modifiers.push(modifier);
        this.activeModifiers.set(traitId, modifiers);
        // Set timeout to remove the modifier after duration
        setTimeout(() => {
            this.removeModifier(traitId, modifier);
        }, modifier.duration);
        this.emit('modifierAdded', { traitId, modifier });
    }
    removeModifier(traitId, modifier) {
        const modifiers = this.activeModifiers.get(traitId) || [];
        const index = modifiers.indexOf(modifier);
        if (index > -1) {
            modifiers.splice(index, 1);
            if (modifiers.length === 0) {
                this.activeModifiers.delete(traitId);
            }
            else {
                this.activeModifiers.set(traitId, modifiers);
            }
            this.emit('modifierRemoved', { traitId, modifier });
        }
    }
    getEffectiveWeight(traitId) {
        const trait = this.traits.get(traitId);
        if (!trait)
            return 0;
        const modifiers = this.activeModifiers.get(traitId) || [];
        let weight = trait.weight;
        // Apply all active modifiers
        modifiers.forEach(modifier => {
            weight *= modifier.weightMultiplier;
        });
        return Math.max(0, Math.min(1, weight));
    }
    getTraitInfluence(context) {
        const influence = {};
        this.getAllTraits().forEach(trait => {
            if (trait.active) {
                const effectiveWeight = this.getEffectiveWeight(trait.id);
                influence[trait.id] = this.calculateContextualInfluence(trait, effectiveWeight, context);
            }
        });
        return influence;
    }
    calculateContextualInfluence(trait, weight, context) {
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
export function createTrait(name, category, weight, parameters) {
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
export function createParameter(name, value, min, max, description) {
    return {
        name,
        value: Math.max(min, Math.min(max, value)),
        min,
        max,
        description
    };
}
