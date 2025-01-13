/**
 * DeepSeek AI Provider Integration
 *
 * This module implements the LLMProvider interface for DeepSeek's AI API service.
 * It provides chat completion functionality compatible with the OpenAI API format.
 *
 * @module deepSeekProvider
 */
import axios from 'axios';
/**
 * DeepSeek API provider implementation
 * Implements the LLMProvider interface for DeepSeek's AI service
 */
export class DeepSeekProvider {
    /** Base URL for DeepSeek API endpoints */
    baseUrl;
    /** API key for authentication with DeepSeek services */
    apiKey;
    constructor(apiKey) {
        this.baseUrl = 'https://api.deepseek.com';
        this.apiKey = apiKey;
    }
    /**
     * Sends a chat completion request to the DeepSeek API
     *
     * @param request - Chat completion request parameters
     * @param request.model - Model to use (defaults to 'deepseek-chat')
     * @param request.messages - Array of chat messages
     * @param request.stream - Whether to stream the response (defaults to false)
     * @param request.temperature - Sampling temperature (defaults to 0.7)
     * @param request.max_tokens - Maximum tokens to generate (defaults to 1024)
     * @returns Promise resolving to the chat completion response
     */
    async chatCompletion(request) {
        const res = await axios.post(`${this.baseUrl}/chat/completions`, {
            model: request.model || 'deepseek-chat',
            messages: request.messages,
            stream: request.stream || false,
            temperature: request.temperature || 0.7,
            max_tokens: request.max_tokens || 1024
        }, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`
            }
        });
        return res.data;
    }
}
