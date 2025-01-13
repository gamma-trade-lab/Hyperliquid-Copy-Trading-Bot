import { OpenAIProvider } from '../providers/openai.provider.js';
import { ClaudeProvider } from '../providers/claude.provider.js';
import { OllamaProvider } from '../providers/ollama.provider.js';
import { DeepSeekProvider } from '../providers/deepseek.provider.js';
import { logger } from '../../utils/logger.js';
export class ModelFactory {
    static instance;
    providers;
    constructor() {
        this.providers = new Map();
    }
    static getInstance() {
        if (!ModelFactory.instance) {
            ModelFactory.instance = new ModelFactory();
        }
        return ModelFactory.instance;
    }
    async initializeProvider(type, config) {
        try {
            let provider;
            switch (type) {
                case 'openai':
                    provider = new OpenAIProvider();
                    break;
                case 'claude':
                    provider = new ClaudeProvider();
                    break;
                case 'ollama':
                    provider = new OllamaProvider();
                    break;
                case 'deepseek':
                    provider = new DeepSeekProvider();
                    break;
                default:
                    throw new Error(`Unsupported model type: ${type}`);
            }
            await provider.initialize(config);
            this.providers.set(type, provider);
            logger.info(`Provider ${type} initialized successfully`);
        }
        catch (error) {
            logger.error(`Error initializing provider ${type}:`, error);
            throw error;
        }
    }
    getProvider(type) {
        const provider = this.providers.get(type);
        if (!provider) {
            throw new Error(`Provider ${type} not initialized`);
        }
        return provider;
    }
    async initializeAll(configs) {
        const initPromises = Object.entries(configs).map(([type, config]) => this.initializeProvider(type, config));
        try {
            await Promise.all(initPromises);
            logger.info('All providers initialized successfully');
        }
        catch (error) {
            logger.error('Error initializing providers:', error);
            throw error;
        }
    }
    isInitialized(type) {
        return this.providers.has(type);
    }
    getAllInitialized() {
        return Array.from(this.providers.keys());
    }
}
