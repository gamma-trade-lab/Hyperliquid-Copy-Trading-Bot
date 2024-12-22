import { Provider, IAgentRuntime, Memory, State } from '@ai16z/eliza';
import { TranslationData, TranslationProviderResponse } from '../types';

// Simple in-memory cache
const translationCache = new Map<string, TranslationData>();

// Helper function to cache translations
export const cacheTranslation = (data: TranslationData): void => {
  try {
    const cacheKey = `${data.sourceText.toLowerCase()}:${data.targetLang.toLowerCase()}`;
    translationCache.set(cacheKey, data);

    // Implement cache size limit
    if (translationCache.size > 1000) {
      const firstKey = translationCache.keys().next().value;
      if (firstKey) {
        translationCache.delete(firstKey);
      }
    }
  } catch (error) {
    console.error('Failed to cache translation:', error);
  }
};

export const translationProvider: Provider = {
  get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<TranslationProviderResponse> => {
    try {
      const content = message.content as { text: string };
      const match = content.text.match(/translate\s+"([^"]+)"\s+to\s+(\w+)/i);

      if (!match) {
        return {
          success: false,
          error: 'Invalid translation request format'
        };
      }

      const [, sourceText, targetLang] = match;
      const cacheKey = `${sourceText.toLowerCase()}:${targetLang.toLowerCase()}`;
      const cachedData = translationCache.get(cacheKey);

      if (cachedData) {
        return {
          success: true,
          data: cachedData
        };
      }

      return {
        success: false,
        error: 'Translation not found in cache'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve translation'
      };
    }
  }
};
