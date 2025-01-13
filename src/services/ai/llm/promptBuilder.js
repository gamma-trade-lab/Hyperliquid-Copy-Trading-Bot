// src/services/ai/llm/promptBuilder.ts
import { EventEmitter } from 'events';
var PromptType;
(function (PromptType) {
    PromptType["MARKET_ANALYSIS"] = "market_analysis";
    PromptType["SOCIAL_ENGAGEMENT"] = "social_engagement";
    PromptType["COMMUNITY_MANAGEMENT"] = "community_management";
    PromptType["TRADING_STRATEGY"] = "trading_strategy";
    PromptType["CONTENT_GENERATION"] = "content_generation";
    PromptType["SENTIMENT_ANALYSIS"] = "sentiment_analysis";
})(PromptType || (PromptType = {}));
export class PromptBuilder extends EventEmitter {
    templates;
    defaultConfig;
    MAX_PROMPT_LENGTH = 4000;
    constructor(defaultConfig = {}) {
        super();
        this.templates = new Map();
        this.defaultConfig = {
            maxLength: 2000,
            temperature: 0.7,
            topP: 0.9,
            frequencyPenalty: 0.0,
            presencePenalty: 0.0,
            ...defaultConfig
        };
        this.initializeTemplates();
    }
    initializeTemplates() {
        // Market Analysis Templates
        this.addTemplate({
            id: 'market-trend-analysis',
            type: PromptType.MARKET_ANALYSIS,
            template: `
        Analyze the following market data and provide insights:
        Price: {price}
        Volume: {volume}
        Time Frame: {timeframe}
        Previous Trends: {trends}
        
        Consider:
        1. Market sentiment and momentum
        2. Key support/resistance levels
        3. Volume patterns and anomalies
        4. Potential catalysts
        
        Provide analysis in the following format:
        - Trend Direction
        - Strength Indicators
        - Risk Factors
        - Opportunity Assessment
        - Actionable Recommendations
      `,
            variables: ['price', 'volume', 'timeframe', 'trends'],
            examples: [
                'Detailed market analysis example with clear insights...'
            ],
            metadata: {
                description: 'Generates comprehensive market trend analysis',
                category: 'trading',
                expectedOutput: 'Structured market analysis with actionable insights',
                version: '1.0'
            }
        });
        // Social Engagement Templates
        this.addTemplate({
            id: 'viral-content-generation',
            type: PromptType.SOCIAL_ENGAGEMENT,
            template: `
        Generate viral content based on:
        Topic: {topic}
        Platform: {platform}
        Current Trends: {trends}
        Target Audience: {audience}
        
        Content should:
        1. Be attention-grabbing and memorable
        2. Align with community values
        3. Encourage engagement and sharing
        4. Include relevant hooks and hashtags
        
        Format:
        - Hook
        - Main Content
        - Call to Action
        - Hashtags
      `,
            variables: ['topic', 'platform', 'trends', 'audience'],
            metadata: {
                description: 'Creates viral social media content',
                category: 'social',
                version: '1.0'
            }
        });
    }
    async buildPrompt(templateId, variables, config) {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }
        // Validate required variables
        this.validateVariables(template, variables);
        // Build prompt from template
        let prompt = this.fillTemplate(template, variables);
        // Add examples if available
        if (template.examples && template.examples.length > 0) {
            prompt = this.addExamples(prompt, template.examples);
        }
        // Apply prompt optimization
        prompt = await this.optimizePrompt(prompt, template.type);
        // Merge configurations
        const finalConfig = {
            ...this.defaultConfig,
            ...config
        };
        return {
            prompt: this.enforceMaxLength(prompt, finalConfig.maxLength),
            config: finalConfig
        };
    }
    validateVariables(template, variables) {
        const missingVariables = template.variables.filter(variable => !variables.hasOwnProperty(variable));
        if (missingVariables.length > 0) {
            throw new Error(`Missing required variables: ${missingVariables.join(', ')}`);
        }
    }
    fillTemplate(template, variables) {
        let prompt = template.template;
        // Replace variables
        Object.entries(variables).forEach(([key, value]) => {
            const regex = new RegExp(`{${key}}`, 'g');
            prompt = prompt.replace(regex, String(value));
        });
        return prompt;
    }
    addExamples(prompt, examples) {
        return `
      Examples:
      ${examples.map((example, index) => `${index + 1}. ${example}`).join('\n')}
      
      Now, following the above examples:
      ${prompt}
    `;
    }
    async optimizePrompt(prompt, type) {
        // Add type-specific optimizations
        switch (type) {
            case PromptType.MARKET_ANALYSIS:
                prompt = this.optimizeMarketAnalysis(prompt);
                break;
            case PromptType.SOCIAL_ENGAGEMENT:
                prompt = this.optimizeSocialEngagement(prompt);
                break;
            case PromptType.TRADING_STRATEGY:
                prompt = this.optimizeTradingStrategy(prompt);
                break;
            default:
                break;
        }
        // General optimizations
        prompt = this.applyGeneralOptimizations(prompt);
        return prompt;
    }
    optimizeMarketAnalysis(prompt) {
        return `
      Context: You are a professional market analyst with deep expertise in crypto markets.
      
      ${prompt}
      
      Note: Provide specific, data-driven insights and avoid generic statements.
    `;
    }
    optimizeSocialEngagement(prompt) {
        return `
      Context: You are a social media expert skilled in creating viral crypto content.
      
      ${prompt}
      
      Note: Focus on authenticity and community engagement.
    `;
    }
    optimizeTradingStrategy(prompt) {
        return `
      Context: You are an experienced crypto trader with a track record of successful trades.
      
      ${prompt}
      
      Note: Include risk management considerations and precise entry/exit points.
    `;
    }
    applyGeneralOptimizations(prompt) {
        // Remove excessive whitespace
        prompt = prompt.replace(/\s+/g, ' ').trim();
        // Add structure markers
        prompt = prompt.replace(/(\d+\.)/g, '\n$1');
        return prompt;
    }
    enforceMaxLength(prompt, maxLength) {
        const actualMaxLength = Math.min(maxLength, this.MAX_PROMPT_LENGTH);
        if (prompt.length <= actualMaxLength)
            return prompt;
        // Truncate while keeping structure
        return prompt.slice(0, actualMaxLength - 3) + '...';
    }
    addTemplate(template) {
        this.validateTemplate(template);
        this.templates.set(template.id, template);
        this.emit('templateAdded', template);
    }
    validateTemplate(template) {
        if (!template.id || !template.template || !template.variables) {
            throw new Error('Invalid template structure');
        }
        // Check for valid variable placeholders
        template.variables.forEach(variable => {
            if (!template.template.includes(`{${variable}}`)) {
                throw new Error(`Template missing placeholder for variable: ${variable}`);
            }
        });
    }
    getTemplate(templateId) {
        return this.templates.get(templateId);
    }
    listTemplates(type) {
        const templates = Array.from(this.templates.values());
        return type ? templates.filter(t => t.type === type) : templates;
    }
}
