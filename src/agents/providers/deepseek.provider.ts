import axios from 'axios';
import { AIProvider, ModelConfig, ModelResponse, PromptConfig } from './base.provider';
import { logger } from '../../utils/logger';

export class DeepSeekProvider implements AIProvider {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  public readonly name = 'deepseek';

  async initialize(config: { apiKey: string; baseUrl?: string; model?: string }): Promise<void> {
    if (!this.validateConfig(config)) {
      throw new Error('Invalid DeepSeek configuration');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.deepseek.com/v1';
    this.model = config.model || 'deepseek-coder-33b-instruct';
    logger.info('DeepSeek provider initialized', { model: this.model });
  }

  async generateResponse(prompt: PromptConfig, config?: ModelConfig): Promise<ModelResponse> {
    try {
      const modelConfig = { ...this.getDefaultConfig(), ...config };
      const messages = this.formatPrompt(prompt);

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages,
          temperature: modelConfig.temperature,
          max_tokens: modelConfig.maxTokens,
          top_p: modelConfig.topP,
          frequency_penalty: modelConfig.frequencyPenalty,
          presence_penalty: modelConfig.presencePenalty,
          stop: modelConfig.stop
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        content: response.data.choices[0].message.content,
        usage: {
          promptTokens: response.data.usage.prompt_tokens,
          completionTokens: response.data.usage.completion_tokens,
          totalTokens: response.data.usage.total_tokens
        },
        metadata: {
          model: response.data.model,
          finishReason: response.data.choices[0].finish_reason
        }
      };
    } catch (error) {
      logger.error('Error generating DeepSeek response:', error);
      throw error;
    }
  }

  async *streamResponse(prompt: PromptConfig, config?: ModelConfig): AsyncGenerator<string> {
    try {
      const modelConfig = { ...this.getDefaultConfig(), ...config };
      const messages = this.formatPrompt(prompt);

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages,
          temperature: modelConfig.temperature,
          max_tokens: modelConfig.maxTokens,
          top_p: modelConfig.topP,
          frequency_penalty: modelConfig.frequencyPenalty,
          presence_penalty: modelConfig.presencePenalty,
          stop: modelConfig.stop,
          stream: true
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'stream'
        }
      );

      for await (const chunk of response.data) {
        const lines = chunk
          .toString()
          .split('\n')
          .filter((line: string) => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.choices[0].delta.content) {
              yield data.choices[0].delta.content;
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error streaming DeepSeek response:', error);
      throw error;
    }
  }

  validateConfig(config: Record<string, any>): boolean {
    return Boolean(config.apiKey);
  }

  getDefaultConfig(): ModelConfig {
    return {
      temperature: 0.7,
      maxTokens: 2048,
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