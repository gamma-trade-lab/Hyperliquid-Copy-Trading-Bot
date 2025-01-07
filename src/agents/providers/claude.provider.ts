import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, ModelConfig, ModelResponse, PromptConfig } from './base.provider';
import { logger } from '../../utils/logger';

export class ClaudeProvider implements AIProvider {
  private client: Anthropic;
  private model: string;
  public readonly name = 'claude';

  async initialize(config: { apiKey: string; model?: string }): Promise<void> {
    if (!this.validateConfig(config)) {
      throw new Error('Invalid Claude configuration');
    }

    this.client = new Anthropic({
      apiKey: config.apiKey
    });
    this.model = config.model || 'claude-3-opus-20240229';
    logger.info('Claude provider initialized', { model: this.model });
  }

  async generateResponse(prompt: PromptConfig, config?: ModelConfig): Promise<ModelResponse> {
    try {
      const modelConfig = { ...this.getDefaultConfig(), ...config };
      const formattedPrompt = this.formatPrompt(prompt);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        top_p: modelConfig.topP,
        messages: [
          {
            role: 'user',
            content: formattedPrompt
          }
        ]
      });

      return {
        content: response.content[0].text,
        usage: {
          promptTokens: 0, // Claude doesn't provide token usage
          completionTokens: 0,
          totalTokens: 0
        },
        metadata: {
          model: response.model,
          stopReason: response.stop_reason
        }
      };
    } catch (error) {
      logger.error('Error generating Claude response:', error);
      throw error;
    }
  }

  async *streamResponse(prompt: PromptConfig, config?: ModelConfig): AsyncGenerator<string> {
    try {
      const modelConfig = { ...this.getDefaultConfig(), ...config };
      const formattedPrompt = this.formatPrompt(prompt);

      const stream = await this.client.messages.create({
        model: this.model,
        max_tokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        top_p: modelConfig.topP,
        messages: [
          {
            role: 'user',
            content: formattedPrompt
          }
        ],
        stream: true
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.text) {
          yield chunk.delta.text;
        }
      }
    } catch (error) {
      logger.error('Error streaming Claude response:', error);
      throw error;
    }
  }

  validateConfig(config: Record<string, any>): boolean {
    return Boolean(config.apiKey);
  }

  getDefaultConfig(): ModelConfig {
    return {
      temperature: 0.7,
      maxTokens: 4000,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0
    };
  }

  private formatPrompt(prompt: PromptConfig): string {
    let formattedPrompt = '';

    if (prompt.systemPrompt) {
      formattedPrompt += `System: ${prompt.systemPrompt}\n\n`;
    }

    if (prompt.examples) {
      for (const example of prompt.examples) {
        formattedPrompt += `Human: ${example.input}\n\nAssistant: ${example.output}\n\n`;
      }
    }

    formattedPrompt += `Human: ${prompt.userPrompt}\n\nAssistant:`;

    return formattedPrompt;
  }
} 