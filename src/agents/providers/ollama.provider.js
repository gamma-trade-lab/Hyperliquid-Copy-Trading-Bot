import Ollama from 'node-ollama';
import { logger } from '../../utils/logger.js';
export class OllamaProvider {
    client;
    model;
    name = 'ollama';
    async initialize(config) {
        if (!this.validateConfig(config)) {
            throw new Error('Invalid Ollama configuration');
        }
        this.client = new Ollama({
            host: config.host
        });
        this.model = config.model || 'deepseek-coder:33b';
        logger.info('Ollama provider initialized', { model: this.model });
    }
    async generateResponse(prompt, config) {
        try {
            const modelConfig = { ...this.getDefaultConfig(), ...config };
            const formattedPrompt = this.formatPrompt(prompt);
            const response = await this.client.generate({
                model: this.model,
                prompt: formattedPrompt,
                options: {
                    temperature: modelConfig.temperature,
                    top_p: modelConfig.topP,
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
                    promptEvalDuration: response.prompt_eval_duration,
                    evalDuration: response.eval_duration
                }
            };
        }
        catch (error) {
            logger.error('Error generating Ollama response:', error);
            throw error;
        }
    }
    async *streamResponse(prompt, config) {
        try {
            const modelConfig = { ...this.getDefaultConfig(), ...config };
            const formattedPrompt = this.formatPrompt(prompt);
            const stream = await this.client.generateStream({
                model: this.model,
                prompt: formattedPrompt,
                options: {
                    temperature: modelConfig.temperature,
                    top_p: modelConfig.topP,
                    stop: modelConfig.stop
                }
            });
            for await (const chunk of stream) {
                if (chunk.response) {
                    yield chunk.response;
                }
            }
        }
        catch (error) {
            logger.error('Error streaming Ollama response:', error);
            throw error;
        }
    }
    validateConfig(config) {
        return Boolean(config.host);
    }
    getDefaultConfig() {
        return {
            temperature: 0.7,
            maxTokens: 2048,
            topP: 1,
            frequencyPenalty: 0,
            presencePenalty: 0
        };
    }
    formatPrompt(prompt) {
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
