import { Ollama } from 'node-ollama';
import { AIProvider, ModelConfig, ModelResponse, PromptConfig } from './base.provider';
import { logger } from '../../utils/logger';

export class OllamaProvider implements AIProvider {
  private client: Ollama;
  private model: string;
  public readonly name = 'ollama';

  async initialize(config: { host: string; model?: string }): Promise<void> {
    if (!this.validateConfig(config)) {
      throw new Error('Invalid Ollama configuration');
    }

    this.client = new Ollama({
      host: config.host
    });
    this.model = config.model || 'deepseek-coder:33b';
    logger.info('Ollama provider initialized', { model: this.model });
  }

  async generateResponse(prompt: PromptConfig, config?: ModelConfig): Promise<ModelResponse> {
    try {
      const modelConfig = { ...this.getDefaultConfig(), ...config };
      const formattedPrompt = this.formatPrompt(prompt);

      const response = await this.client.generate({
        model: this.model,
        prompt: formattedPrompt,
        options: {
          temperature: modelConfig.temperature,
          topP: modelConfig.topP,
          stop: modelConfig.stop
        }
      });

      return {
        content: response.response,
        usage: {
          promptTokens: 0, // Ollama doesn't provide token usage
          completionTokens: 0,
          totalTokens: 0
        },
        metadata: {
          model: this.model,
          totalDuration: response.total_duration,
          loadDuration: response.load_duration,
          promptEvalCount: response.prompt_eval_count,
          evalCount: response.eval_count
        }
      };
    } catch (error) {
      logger.error('Error generating Ollama response:', error);
      throw error;
    }
  }

  async *streamResponse(prompt: PromptConfig, config?: ModelConfig): AsyncGenerator<string> {
    try {
      const modelConfig = { ...this.getDefaultConfig(), ...config };
      const formattedPrompt = this.formatPrompt(prompt);

      const stream = await this.client.generateStream({
        model: this.model,
        prompt: formattedPrompt,
        options: {
          temperature: modelConfig.temperature,
          topP: modelConfig.topP,
          stop: modelConfig.stop
        }
      });

      for await (const chunk of stream) {
        if (chunk.response) {
          yield chunk.response;
        }
      }
    } catch (error) {
      logger.error('Error streaming Ollama response:', error);
      throw error;
    }
  }

  validateConfig(config: Record<string, any>): boolean {
    return Boolean(config.host);
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

  private formatPrompt(prompt: PromptConfig): string {
    let formattedPrompt = '';

    if (prompt.systemPrompt) {
      formattedPrompt += `### System:\n${prompt.systemPrompt}\n\n`;
    }

    if (prompt.examples) {
      formattedPrompt += '### Examples:\n';
      for (const example of prompt.examples) {
        formattedPrompt += `Input: ${example.input}\nOutput: ${example.output}\n\n`;
      }
    }

    formattedPrompt += `### User Input:\n${prompt.userPrompt}\n\n### Response:`;

    return formattedPrompt;
  }
} 