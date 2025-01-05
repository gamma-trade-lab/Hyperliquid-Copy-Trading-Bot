import { describe, it, expect, vi } from 'vitest';
import { AIService } from '../ai';
import { AIServiceConfig } from '../types';

// Mock the settings import
vi.mock('@/config/settings', () => ({
  default: {
    ai: {
      defaultModel: 'deepseek-chat',
      maxTokens: 100,
      temperature: 0.7
    }
  }
}));

describe('AIService', () => {
  it('should initialize with DeepSeek provider and generate responses', async () => {
    const aiService = new AIService({
      useDeepSeek: true,
      deepSeekApiKey: process.env.DEEPSEEK_API_KEY,
      defaultModel: 'deepseek-chat',
      maxTokens: 100,
      temperature: 0.7
    });

    const response = await aiService.generateResponse({
      content: 'Hello assistant',
      author: 'test_user',
      channel: 'test_channel',
      platform: 'test'
    });

    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
  });
});
