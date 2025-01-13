import { EventEmitter } from 'events';
export var TraitCategory;
(function (TraitCategory) {
    TraitCategory["SOCIAL"] = "social";
    TraitCategory["TRADING"] = "trading";
    TraitCategory["CONTENT"] = "content";
    TraitCategory["MARKET"] = "market";
    TraitCategory["TECHNICAL"] = "technical";
    TraitCategory["CREATIVE"] = "creative";
})(TraitCategory || (TraitCategory = {}));
export class TraitManager extends EventEmitter {
    traits = new Map();
    constructor() {
        super();
        this.initializeDefaultTraits();
    }
    initializeDefaultTraits() {
        this.addTrait({
            id: 'social-engagement',
            name: 'Social Engagement',
            category: TraitCategory.SOCIAL,
            weight: 0.8,
            description: 'Ability to engage with community'
        });
        this.addTrait({
            id: 'market-analysis',
            name: 'Market Analysis',
            category: TraitCategory.MARKET,
            weight: 0.7,
            description: 'Ability to analyze market conditions'
        });
    }
    addTrait(trait) {
        this.traits.set(trait.id, trait);
        this.emit('traitAdded', trait);
    }
    removeTrait(id) {
        this.traits.delete(id);
        this.emit('traitRemoved', id);
    }
    getTrait(id) {
        return this.traits.get(id);
    }
    getTraits() {
        return Array.from(this.traits.values());
    }
    getTraitsByCategory(category) {
        return this.getTraits().filter(trait => trait.category === category);
    }
    updateTraitWeight(id, weight) {
        const trait = this.traits.get(id);
        if (trait) {
            trait.weight = weight;
            this.emit('traitUpdated', trait);
        }
    }
}
