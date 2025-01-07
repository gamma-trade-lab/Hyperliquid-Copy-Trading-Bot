import OpenAI from 'openai';
import { AIProvider, ModelConfig, ModelResponse, PromptConfig } from './base.provider';
import { logger } from '../../utils/logger';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;
  public readonly name = 'openai';

  async initialize(config: { apiKey: string; model?: string }): Promise<void> {
    if (!this.validateConfig(config)) {
      throw new Error('Invalid OpenAI configuration');
    }

    this.client = new OpenAI({
      apiKey: config.apiKey
    });
    this.model = config.model || 'gpt-4-1106-preview';
    logger.info('OpenAI provider initialized', { model: this.model });
  }

  async generateResponse(prompt: PromptConfig, config?: ModelConfig): Promise<ModelResponse> {
    try {
      const messages = this.formatPrompt(prompt);
      const modelConfig = { ...this.getDefaultConfig(), ...config };

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: modelConfig.temperature,
        max_tokens: modelConfig.maxTokens,
        top_p: modelConfig.topP,
        frequency_penalty: modelConfig.frequencyPenalty,
        presence_penalty: modelConfig.presencePenalty,
        stop: modelConfig.stop
      });

      return {
        content: response.choices[0].message.content || '',
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        },
        metadata: {
          model: response.model,
          systemFingerprint: response.system_fingerprint
        }
      };
    } catch (error) {
      logger.error('Error generating OpenAI response:', error);
      throw error;
    }
  }

  async *streamResponse(prompt: PromptConfig, config?: ModelConfig): AsyncGenerator<string> {
    try {
      const messages = this.formatPrompt(prompt);
      const modelConfig = { ...this.getDefaultConfig(), ...config };

      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: modelConfig.temperature,
        max_tokens: modelConfig.maxTokens,
        top_p: modelConfig.topP,
        frequency_penalty: modelConfig.frequencyPenalty,
        presence_penalty: modelConfig.presencePenalty,
        stop: modelConfig.stop,
        stream: true
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      logger.error('Error streaming OpenAI response:', error);
      throw error;
    }
  }

  validateConfig(config: Record<string, any>): boolean {
    return Boolean(config.apiKey);
  }

  getDefaultConfig(): ModelConfig {
    return {
      temperature: 0.7,
      maxTokens: 2000,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0
    };
  }

  private formatPrompt(prompt: PromptConfig): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    if (prompt.systemPrompt) {
      messages.push({ role: 'system', content: prompt.systemPrompt });
    }

    if (prompt.examples) {
      for (const example of prompt.examples) {
        messages.push({ role: 'user', content: example.input });
        messages.push({ role: 'assistant', content: example.output });
      }
    }

    messages.push({ role: 'user', content: prompt.userPrompt });

    return messages;
  }
} 