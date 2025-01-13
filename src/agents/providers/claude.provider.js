import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../utils/logger.js';
export class ClaudeProvider {
    client;
    model;
    name = 'claude';
    async initialize(config) {
        if (!this.validateConfig(config)) {
            throw new Error('Invalid Claude configuration');
        }
        this.client = new Anthropic({
            apiKey: config.apiKey
        });
        this.model = config.model || 'claude-3-opus-20240229';
        logger.info('Claude provider initialized', { model: this.model });
    }
    async generateResponse(prompt, config) {
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
            }
            else if (content && typeof content === 'object' && 'type' in content) {
                const block = content;
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
        }
        catch (error) {
            logger.error('Error generating Claude response:', error);
            throw error;
        }
    }
    async *streamResponse(prompt, config) {
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
            }
            else if (content && typeof content === 'object' && 'type' in content) {
                const block = content;
                if (block.type === 'text') {
                    contentText = block.text;
                }
            }
            yield contentText;
        }
        catch (error) {
            logger.error('Error streaming Claude response:', error);
            throw error;
        }
    }
    validateConfig(config) {
        return Boolean(config.apiKey);
    }
    getDefaultConfig() {
        return {
            temperature: 0.7,
            maxTokens: 4000,
            topP: 1,
            frequencyPenalty: 0,
            presencePenalty: 0
        };
    }
    formatPrompt(prompt) {
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
