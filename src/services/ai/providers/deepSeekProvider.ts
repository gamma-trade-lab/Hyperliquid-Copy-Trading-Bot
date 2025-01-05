import axios from 'axios';
import { LLMProvider, ChatRequest, ChatResponse } from '../types';

export class DeepSeekProvider implements LLMProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string) {
    this.baseUrl = 'https://api.deepseek.com';
    this.apiKey = apiKey;
  }

  public async chatCompletion(request: ChatRequest): Promise<ChatResponse> {
    const res = await axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model: request.model || 'deepseek-chat',
        messages: request.messages,
        stream: request.stream || false,
        temperature: request.temperature || 0.7,
        max_tokens: request.max_tokens || 1024
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        }
      }
    );
    return res.data;
  }
}
