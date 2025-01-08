export interface ModelConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
}

export interface PromptConfig {
  systemPrompt?: string;
  userPrompt: string;
  examples?: Array<{ input: string; output: string }>;
}

export interface ModelResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, any>;
}

export interface AIProvider {
  name: string;
  initialize(config: Record<string, any>): Promise<void>;
  generateResponse(prompt: PromptConfig, config?: ModelConfig): Promise<ModelResponse>;
  streamResponse?(prompt: PromptConfig, config?: ModelConfig): AsyncGenerator<string>;
  validateConfig(config: Record<string, any>): boolean;
  getDefaultConfig(): ModelConfig;
} 