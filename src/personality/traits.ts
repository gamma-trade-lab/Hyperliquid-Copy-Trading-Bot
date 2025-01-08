import { EventEmitter } from 'events';

export enum TraitCategory {
  SOCIAL = 'social',
  TRADING = 'trading',
  CONTENT = 'content',
  MARKET = 'market',
  TECHNICAL = 'technical',
  CREATIVE = 'creative'
}

export interface Trait {
  id: string;
  name: string;
  category: TraitCategory;
  weight: number;
  description: string;
}

export class TraitManager extends EventEmitter {
  private traits: Map<string, Trait> = new Map();

  constructor() {
    super();
    this.initializeDefaultTraits();
  }

  private initializeDefaultTraits(): void {
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

  public addTrait(trait: Trait): void {
    this.traits.set(trait.id, trait);
    this.emit('traitAdded', trait);
  }

  public removeTrait(id: string): void {
    this.traits.delete(id);
    this.emit('traitRemoved', id);
  }

  public getTrait(id: string): Trait | undefined {
    return this.traits.get(id);
  }

  public getTraits(): Trait[] {
    return Array.from(this.traits.values());
  }

  public getTraitsByCategory(category: TraitCategory): Trait[] {
    return this.getTraits().filter(trait => trait.category === category);
  }

  public updateTraitWeight(id: string, weight: number): void {
    const trait = this.traits.get(id);
    if (trait) {
      trait.weight = weight;
      this.emit('traitUpdated', trait);
    }
  }
}
