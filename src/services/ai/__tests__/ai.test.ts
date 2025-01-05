import { jest, describe, it, expect } from '@jest/globals';
import { AIService } from '../ai';
import { AIServiceConfig, ChatRequest, ChatResponse, LLMProvider } from '../types';

// Mock the settings module
jest.mock('../../../config/settings');

// Mock DeepSeek provider
const mockDeepSeekResponse: ChatResponse = {
  id: 'mock-response-id',
  object: 'chat.completion',
  created: Date.now(),
  choices: [{
    message: {
      role: 'assistant',
      content: 'Test response from mock provider'
    },
    finish_reason: 'stop'
  }]
};

// Create mock provider with explicit typing
const mockChatCompletionFn = jest.fn(async (_request: ChatRequest): Promise<ChatResponse> => {
  return mockDeepSeekResponse;
});

const mockProvider: LLMProvider = {
  chatCompletion: mockChatCompletionFn
};

jest.mock('../providers/deepSeekProvider', () => ({
  DeepSeekProvider: jest.fn().mockImplementation(() => mockProvider)
}));

describe('AIService', () => {
  const TEST_CONFIG = {
    useDeepSeek: true,
    deepSeekApiKey: 'test-key',
    defaultModel: 'deepseek-chat',
    maxTokens: 100,
    temperature: 0.7
  };

  let aiService: AIService;

  beforeEach(() => {
    aiService = new AIService(TEST_CONFIG);
  });

  it('should initialize with DeepSeek provider and generate responses', async () => {
    const response = await aiService.generateResponse({
      content: 'Hello assistant',
      author: 'test_user',
      channel: 'test_channel',
      platform: 'test'
    });

    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
    expect(response).toBe('Test response from mock provider');
  });
});
