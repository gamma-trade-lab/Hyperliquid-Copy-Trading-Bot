import { ChatGroq } from "@langchain/groq";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { elizaLogger } from "@ai16z/eliza";
import { CONFIG } from '../config/settings.js';

class GroqModelManager {
  private static instance: ChatGroq | null = null;

  static initialize(): ChatGroq {
    try {
      if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY not found in environment variables');
      }

      if (!this.instance) {
        this.instance = new ChatGroq({
          apiKey: process.env.GROQ_API_KEY,
          modelName: CONFIG.AI.GROQ.MODEL,
          temperature: CONFIG.AI.GROQ.DEFAULT_TEMPERATURE,
          maxTokens: CONFIG.AI.GROQ.MAX_TOKENS,
          streaming: false,
        });
      }

      return this.instance;
    } catch (error) {
      elizaLogger.error('Failed to initialize Groq model:', error);
      throw error;
    }
  }

  static getInstance(): ChatGroq {
    if (!this.instance) {
      return this.initialize();
    }
    return this.instance;
  }

  static resetInstance(): void {
    this.instance = null;
  }
}

// Initialize model with error handling
let groqModel: BaseChatModel;
try {
  groqModel = GroqModelManager.initialize();
  elizaLogger.success('Groq model initialized successfully');
} catch (error) {
  elizaLogger.error('Failed to initialize Groq model:', error);
  throw error;
}

// Export the model interface
export const getModel = (p0: string): BaseChatModel => {
  try {
    return GroqModelManager.getInstance();
  } catch (error) {
    elizaLogger.error('Error getting Groq model instance:', error);
    throw error;
  }
};

// Export singleton instance
export const groq = groqModel;

// Export utility functions
export const resetModel = (): void => {
  try {
    GroqModelManager.resetInstance();
    elizaLogger.info('Groq model instance reset');
  } catch (error) {
    elizaLogger.error('Error resetting Groq model:', error);
    throw error;
  }
};

// Add type guard
export const isGroqModel = (model: unknown): model is ChatGroq => {
  return model instanceof ChatGroq;
};

// Export configuration helper
export const getModelConfig = () => ({
  modelName: CONFIG.AI.GROQ.MODEL,
  temperature: CONFIG.AI.GROQ.DEFAULT_TEMPERATURE,
  maxTokens: CONFIG.AI.GROQ.MAX_TOKENS
});