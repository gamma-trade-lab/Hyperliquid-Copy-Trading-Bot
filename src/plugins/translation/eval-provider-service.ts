import { Evaluator, ActionExample, IAgentRuntime, Memory } from "@ai16z/eliza";

interface TranslationEvalContent {
  text: string;
  translationData?: {
    sourceText: string;
    targetText: string;
    sourceLang: string;
    targetLang: string;
    confidence: number;
  };
}

interface TranslationEvalResponse {
  isValid: boolean;
  reason: string;
  suggestions?: string[];
}

export const translationEvaluator: Evaluator = {
  name: "VALIDATE_TRANSLATION",

  similes: [
    "CHECK_TRANSLATION",
    "TRANSLATION_QUALITY",
    "LANGUAGE_VERIFICATION",
  ],

  description:
    "Validates translation quality, language detection, and provides improvement suggestions",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
  ): Promise<boolean> => {
    const content = message.content as TranslationEvalContent;
    return (
      content.translationData !== undefined ||
      /translate|translation|to english|to spanish/i.test(content.text)
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
  ): Promise<TranslationEvalResponse> => {
    const content = message.content as TranslationEvalContent;

    if (content.translationData) {
      const { confidence, sourceLang, targetLang } = content.translationData;

      // Quality checks
      if (confidence < 0.7) {
        return {
          isValid: false,
          reason: "Low confidence translation",
          suggestions: ["Request human review", "Provide more context"],
        };
      }

      // Language compatibility check
      if (sourceLang === targetLang) {
        return {
          isValid: false,
          reason: "Source and target languages are the same",
        };
      }

      return {
        isValid: true,
        reason: "Translation validated",
        suggestions:
          confidence < 0.9 ? ["Consider reviewing technical terms"] : [],
      };
    }

    return {
      isValid: true,
      reason: "Translation text provided",
      suggestions: ["Add language detection for better accuracy"],
    };
  },

  examples: [
    {
      context: "{{user1}} requests translation",
      messages: [
        {
          user: "{{user1}}",
          content: {
            text: "Translate 'Hello world' to Spanish",
            action: "TRANSLATE",
          },
        },
        {
          user: "TranslateBot",
          content: {
            text: "'Hello world' in Spanish is 'Hola mundo'",
            translationData: {
              sourceText: "Hello world",
              targetText: "Hola mundo",
              sourceLang: "en",
              targetLang: "es",
              confidence: 0.95,
            },
          },
        },
      ],
      outcome: `{
                "isValid": true,
                "reason": "Translation validated"
            }`,
    },
    {
      context: "{{user1}} receives low confidence translation",
      messages: [
        {
          user: "TranslateBot",
          content: {
            text: "Technical translation attempted",
            translationData: {
              sourceText: "Quantum entanglement occurs...",
              targetText: "El entrelazamiento cuántico ocurre...",
              sourceLang: "en",
              targetLang: "es",
              confidence: 0.65,
            },
          },
        },
      ],
      outcome: `{
                "isValid": false,
                "reason": "Low confidence translation",
                "suggestions": ["Request human review", "Provide more context"]
            }`,
    },
  ],

  alwaysRun: true,
};
