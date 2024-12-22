import { Content, Service, ServiceType as ElizaServiceType } from '@ai16z/eliza';

export { ElizaServiceType as ServiceType };

export interface TranslationConfig {
  provider: {
    apiKey: string;
    baseUrl?: string;
    model?: string;
  };
}

export interface TranslationData {
  sourceText: string;
  targetText: string;
  sourceLang: string;
  targetLang: string;
  confidence?: number;
}

export interface TranslationActionContent extends Content {
  text: string;
}

export interface TranslationEvalContent extends Content {
  text: string;
}

export interface TranslationEvalResponse {
  success: boolean;
  response: string;
  confidence?: number;
}

export interface TranslationProviderResponse {
  success: boolean;
  data?: TranslationData;
  error?: string;
}

export interface TranslationServiceConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface TranslationService extends Service {
  translate(text: string, targetLang: string, sourceLang?: string): Promise<TranslationServiceResponse>;
}

export interface TranslationServiceResponse {
  success: boolean;
  translation?: string;
  error?: string;
  metadata?: {
    model: string;
    confidence: number;
    tokensUsed: number;
  };
}
