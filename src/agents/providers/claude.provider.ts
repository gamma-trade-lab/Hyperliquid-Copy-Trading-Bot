import Anthropic, { ContentBlock } from '@anthropic-ai/sdk';
import { AIProvider, ModelConfig, ModelResponse, PromptConfig } from './base.provider.js';
import { logger } from '../../utils/logger.js';

export class ClaudeProvider implements AIProvider {
  private client!: Anthropic;
  private model!: string;
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

      const content = response.content?.[0];
      let contentText = '';
      
      if (typeof content === 'string') {
        contentText = content;
      } else if (content && typeof content === 'object' && 'type' in content) {
        const block = content as ContentBlock;
        if (block.type === 'text') {
          contentText = block.text;
        }
      }
      
      return {
        content: contentText,
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

      // Since Claude v3 doesn't support streaming yet, we'll simulate it by yielding the full response
      const content = response.content?.[0];
      let contentText = '';
      
      if (typeof content === 'string') {
        contentText = content;
      } else if (content && typeof content === 'object' && 'type' in content) {
        const block = content as ContentBlock;
        if (block.type === 'text') {
          contentText = block.text;
        }
      }
      
      yield contentText;
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