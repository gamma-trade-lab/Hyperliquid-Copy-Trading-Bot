import { ChatGroq } from "@langchain/groq";
import { ChatOpenAI } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { CONFIG } from '@/config/settings.js';

// Initialize Groq model
export const groq = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY!,
  modelName: CONFIG.AI.GROQ.MODEL,
  temperature: CONFIG.AI.GROQ.DEFAULT_TEMPERATURE,
});

// Initialize GPT-4 model for comparison/backup
export const gpt4 = new ChatOpenAI({
  modelName: "gpt-4",
  temperature: 0.7,
}) as unknown as BaseChatModel;

// Create a unified model interface
export const getModel = (modelType: 'groq' | 'gpt4' = 'groq'): BaseChatModel => {
  switch (modelType) {
    case 'groq':
      return groq;
    case 'gpt4':
      return gpt4;
    default:
      return groq;
  }
};