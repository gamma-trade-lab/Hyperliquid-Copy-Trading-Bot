// src/services/ai/personality.ts
import { EventEmitter } from 'events';
// Example response context shape for documentation
/*
const exampleResponse: ResponseContext = {
  content: "This is an example response",
  author: "jenna",
  context: {
    key: "value",
    traits: ["friendly", "knowledgeable"],
    metrics: {
      sentiment: 0.8,
      viralPotential: 0.6,
      communityResponse: 0.7,
      timestamp: Date.now()
    }
  },
  platform: "twitter",
  marketCondition: "bullish"
};
*/
// Add any additional code or exports as needed
export class PersonalityService extends EventEmitter {
    config;
    metrics;
    aiService;
    updateInterval;
    constructor(config, aiService) {
        super();
        this.config = config;
        this.metrics = [];
        this.aiService = aiService;
        this.updateInterval = null;
    }
    async loadInitialState() {
        // Implement the logic to load the initial state
        // Placeholder implementation
        console.log('Loading initial state...');
    }
    async initialize() {
        try {
            await this.loadInitialState();
            this.startMetricsCollection();
            this.emit('initialized', {
                traits: this.config.baseTraits,
                metrics: this.getLatestMetrics()
            });
        }
        catch (error) {
            console.error('Failed to initialize personality service:', error);
            throw error;
        }
    }
    async updateTraits(newTraits) {
        try {
            const optimizedTraits = await this.optimizeTraits(newTraits);
            this.config.baseTraits = optimizedTraits;
            this.emit('traitsUpdated', optimizedTraits);
        }
        catch (error) {
            console.error('Failed to update traits:', error);
            throw error;
        }
    }
    async generateResponse(input, context) {
        try {
            const activeTraits = this.getActiveTraits();
            const prompt = this.buildPromptWithTraits(input, activeTraits);
            // Format prompt with context and traits
            const contextualPrompt = `${prompt}\n\nContext:\n${JSON.stringify({
                traits: activeTraits.map(t => t.name),
                metrics: this.getLatestMetrics(),
                ...context
            }, null, 2)}`;
            const response = await this.aiService.generateResponse({
                content: contextualPrompt,
                author: "jenna",
                platform: "twitter"
            });
            this.updateMetricsFromResponse(response);
            return response;
        }
        catch (error) {
            console.error('Failed to generate response:', error);
            throw error;
        }
    }
    updateMetricsFromResponse(response) {
        // Implement the logic to update metrics based on the response
        // Placeholder implementation
        console.log('Updating metrics from response:', response);
    }
    async optimizeTraits(traits) {
        const metrics = this.getLatestMetrics();
        const optimizedTraits = traits.map(trait => ({
            ...trait,
            weight: this.calculateOptimizedWeight(trait, metrics)
        }));
        return optimizedTraits;
    }
    calculateOptimizedWeight(trait, metrics) {
        const base = trait.weight;
        const sentiment = metrics.sentiment;
        const viral = metrics.viralPotential;
        const community = metrics.communityResponse;
        // Weighted optimization based on metrics
        const optimized = base * 0.4 +
            sentiment * 0.2 +
            viral * 0.2 +
            community * 0.2;
        return Math.max(0, Math.min(1, optimized));
    }
    startMetricsCollection() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.updateInterval = setInterval(() => this.collectMetrics(), this.config.updateInterval);
    }
    async collectMetrics() {
        try {
            const newMetrics = {
                sentiment: await this.calculateSentiment(),
                viralPotential: await this.calculateViralPotential(),
                communityResponse: await this.calculateCommunityResponse(),
                timestamp: Date.now()
            };
            this.metrics.push(newMetrics);
            this.metrics = this.metrics.slice(-100); // Keep last 100 metrics
            this.emit('metricsUpdated', newMetrics);
        }
        catch (error) {
            console.error('Failed to collect metrics:', error);
        }
    }
    async calculateSentiment() {
        try {
            const response = await this.aiService.generateResponse({
                content: "Analyze the current market sentiment and return a single number between 0 and 1, where 0 is extremely bearish and 1 is extremely bullish. Return only the number.",
                author: "jenna",
                platform: "market"
            });
            const sentiment = parseFloat(response);
            return isNaN(sentiment) ? 0.5 : Math.max(0, Math.min(1, sentiment));
        }
        catch (error) {
            console.error('Failed to calculate sentiment:', error);
            return 0.5; // Default neutral sentiment
        }
    }
    async calculateViralPotential() {
        try {
            const response = await this.aiService.generateResponse({
                content: "Analyze the viral potential of recent market activity and return a single number between 0 and 1, where 0 is no viral potential and 1 is extremely viral. Return only the number.",
                author: "jenna",
                platform: "market"
            });
            const potential = parseFloat(response);
            return isNaN(potential) ? 0.5 : Math.max(0, Math.min(1, potential));
        }
        catch (error) {
            console.error('Failed to calculate viral potential:', error);
            return 0.5;
        }
    }
    async calculateCommunityResponse() {
        try {
            const response = await this.aiService.generateResponse({
                content: "Analyze the community engagement level and return a single number between 0 and 1, where 0 is no engagement and 1 is extremely high engagement. Return only the number.",
                author: "jenna",
                platform: "social"
            });
            const engagement = parseFloat(response);
            return isNaN(engagement) ? 0.5 : Math.max(0, Math.min(1, engagement));
        }
        catch (error) {
            console.error('Failed to calculate community response:', error);
            return 0.5;
        }
    }
    getLatestMetrics() {
        return this.metrics[this.metrics.length - 1] || {
            sentiment: 0,
            viralPotential: 0,
            communityResponse: 0,
            timestamp: Date.now()
        };
    }
    getActiveTraits() {
        return [...this.config.baseTraits, ...this.config.adaptiveTraits].filter(trait => trait.active);
    }
    buildPromptWithTraits(input, traits) {
        const traitContext = traits
            .map(t => `${t.name} (${(t.weight * 100).toFixed(1)}%)`)
            .join(', ');
        return `
      Context: Acting with the following personality traits: ${traitContext}
      
      Input: ${input}
      
      Generate a response that reflects these personality traits while maintaining authenticity and engagement.
    `;
    }
    cleanup() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.removeAllListeners();
    }
}
