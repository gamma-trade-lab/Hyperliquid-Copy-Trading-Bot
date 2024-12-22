import { Action, IAgentRuntime, Memory, State } from "@ai16z/eliza";
import { TranslationActionContent, TranslationData } from "./types.ts";
import { translationProvider, cacheTranslation } from "./provider/index.ts";
import { translationService } from "./service.ts";

export const getTranslationAction: Action = {
  name: "TRANSLATE_TEXT",
  description: "Translates text between different languages",
  similes: [
    "LANGUAGE_TRANSLATOR",
    "TEXT_TRANSLATOR",
    "TRANSLATION_HELPER",
    "MULTILINGUAL_CONVERTER",
  ],
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: 'Translate "Hello, how are you?" to Spanish' },
      },
      {
        user: "{{agent}}",
        content: { text: '"Hola, ¿cómo estás?" (Confidence: 0.95)' },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: { text: 'Can you translate "Good morning" to French?' },
      },
      {
        user: "{{agent}}",
        content: { text: '"Bonjour" (Confidence: 0.98)' },
      },
    ],
  ],

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    try {
      const content = message.content as TranslationActionContent;
      const text = content.text.toLowerCase();
      return text.includes("translate") && text.includes("to");
    } catch {
      return false;
    }
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<string> => {
    try {
      const content = message.content as TranslationActionContent;
      const text = content.text;

      // Extract text to translate and target language
      const match = text.match(/translate\s+"([^"]+)"\s+to\s+(\w+)/i);
      if (!match) {
        return 'Please provide the text to translate in quotes and specify the target language. For example: Translate "Hello" to Spanish';
      }

      const [, sourceText, targetLang] = match;

      // Check cache first via provider
      const cachedResult = await translationProvider.get(
        runtime,
        message,
        state,
      );
      if (cachedResult.success && cachedResult.data) {
        return `"${cachedResult.data.targetText}" (Cached, Confidence: ${cachedResult.data.confidence})`;
      }

      // If not in cache, use translation service
      const result = await translationService.translate(
        sourceText,
        targetLang.toLowerCase(),
      );
      if (!result.success || !result.translation) {
        return `Sorry, I couldn't translate that. ${result.error || ""}`;
      }

      const translationData: TranslationData = {
        sourceText,
        targetText: result.translation,
        sourceLang: "en", // Default source language
        targetLang: targetLang.toLowerCase(),
        confidence: result.metadata?.confidence,
      };

      // Cache the result
      cacheTranslation(translationData);

      return `"${result.translation}" (Confidence: ${result.metadata?.confidence})`;
    } catch (error) {
      return `Sorry, there was an error processing your translation request: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
};
