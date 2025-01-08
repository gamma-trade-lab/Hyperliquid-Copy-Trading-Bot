import { Plugin } from "@ai16z/eliza";
import { getTranslationAction } from "./action.js";
import { translationEvaluator } from "./evaluator.js";
import { translationProvider } from "./provider/index.js";
import { translationService, initializeTranslationConfig } from "./service.js";
import { TranslationConfig } from "./types.js";

export const translationPlugin: Plugin = {
  name: "translation",
  description: "A plugin for translating text between different languages",
  actions: [getTranslationAction],
  evaluators: [translationEvaluator],
  providers: [translationProvider],
  services: [translationService],
};

export const initializeTranslationPlugin = (
  config: TranslationConfig,
): void => {
  if (config.provider) {
    initializeTranslationConfig(config.provider);
  }
};

export * from "./types.js";
