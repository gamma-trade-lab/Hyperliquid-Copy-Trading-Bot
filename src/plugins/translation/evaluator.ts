import { Evaluator, IAgentRuntime, Memory, State } from "@ai16z/eliza";
import { TranslationEvalContent, TranslationEvalResponse } from "./types.js";

export const translationEvaluator: Evaluator = {
  name: "TRANSLATION_EVALUATOR",
  description: "Validates translation quality and format",
  similes: [
    "TRANSLATION_CHECKER",
    "LANGUAGE_VALIDATOR",
    "TRANSLATION_QUALITY_ASSESSOR",
    "MULTILINGUAL_VERIFIER",
  ],
  examples: [
    {
      context: "Validating translation response format",
      messages: [
        {
          user: "{{user1}}",
          content: { text: '"Hello" in Spanish is "Hola" (Confidence: 0.98)' },
        },
      ],
      outcome: "Translation format is valid with high confidence",
    },
  ],

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    try {
      const content = message.content as TranslationEvalContent;
      return (
        typeof content.text === "string" && content.text.includes("Confidence:")
      );
    } catch {
      return false;
    }
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<TranslationEvalResponse> => {
    try {
      const content = message.content as TranslationEvalContent;
      const text = content.text;

      // Check for proper translation format
      const translationMatch = text.match(
        /"([^"]+)"\s+(?:in|to)\s+(\w+)\s+is\s+"([^"]+)"/i,
      );
      if (!translationMatch) {
        return {
          success: false,
          response: "Invalid translation format",
        };
      }

      // Extract confidence score
      const confidenceMatch = text.match(/Confidence:\s*([\d.]+)/i);
      const confidence = confidenceMatch
        ? parseFloat(confidenceMatch[1])
        : undefined;

      if (confidence !== undefined && (confidence < 0 || confidence > 1)) {
        return {
          success: false,
          response: "Invalid confidence score (must be between 0 and 1)",
        };
      }

      // Validate language names
      const [, sourceText, targetLang, translatedText] = translationMatch;
      const validLanguages = [
        "spanish",
        "french",
        "german",
        "italian",
        "portuguese",
        "chinese",
        "japanese",
        "korean",
      ];
      if (!validLanguages.includes(targetLang.toLowerCase())) {
        return {
          success: false,
          response: "Unsupported target language",
        };
      }

      // Check for empty translations
      if (!sourceText.trim() || !translatedText.trim()) {
        return {
          success: false,
          response: "Empty source or translated text",
        };
      }

      return {
        success: true,
        response: "Translation format and content are valid",
        confidence,
      };
    } catch (error) {
      return {
        success: false,
        response:
          error instanceof Error
            ? error.message
            : "Failed to validate translation",
      };
    }
  },

  alwaysRun: true,
};
