import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { AIService } from '../ai';
import { AIServiceConfig, ChatRequest, ChatResponse, LLMProvider, MarketData } from '../types';

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
    jest.clearAllMocks();
  });

  describe('generateResponse', () => {
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

    it('should handle community content type', async () => {
      const mockCommunityResponse: ChatResponse = {
        ...mockDeepSeekResponse,
        choices: [{
          message: {
            role: 'assistant',
            content: 'Community engagement response'
          },
          finish_reason: 'stop'
        }]
      };

      mockChatCompletionFn.mockResolvedValueOnce(mockCommunityResponse);

      const response = await aiService.generateResponse({
        content: 'Community update',
        author: 'test_user',
        platform: 'twitter',
        contentType: 'community',
        context: {
          marketCondition: 'bullish',
          communityMetrics: {
            totalFollowers: 1000,
            activeUsers24h: 100,
            sentimentScore: 0.8,
            topInfluencers: ['user1', 'user2']
          }
        }
      });

      expect(response).toBe('Community engagement response');
      expect(mockChatCompletionFn).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('community')
            })
          ])
        })
      );
    });
  });

  describe('analyzeMarket', () => {
    const mockMarketData: MarketData = {
      price: 100,
      volume24h: 1000000,
      marketCap: 10000000,
      priceChange24h: 5.5,
      topHolders: [
        { address: 'dummy1', balance: 1000 },
        { address: 'dummy2', balance: 500 }
      ]
    };

    it('should handle valid JSON response', async () => {
      const mockValidResponse: ChatResponse = {
        ...mockDeepSeekResponse,
        choices: [{
          message: {
            role: 'assistant',
            content: JSON.stringify({
              shouldTrade: true,
              confidence: 0.8,
              action: 'BUY',
              metrics: mockMarketData
            })
          },
          finish_reason: 'stop'
        }]
      };

      mockChatCompletionFn.mockResolvedValueOnce(mockValidResponse);

      const result = await aiService.analyzeMarket(mockMarketData);
      expect(result.shouldTrade).toBe(true);
      expect(result.confidence).toBe(0.8);
      expect(result.action).toBe('BUY');
    });

    it('should handle invalid JSON response', async () => {
      const mockInvalidResponse: ChatResponse = {
        ...mockDeepSeekResponse,
        choices: [{
          message: {
            role: 'assistant',
            content: 'Invalid JSON response'
          },
          finish_reason: 'stop'
        }]
      };

      mockChatCompletionFn.mockResolvedValueOnce(mockInvalidResponse);

      const result = await aiService.analyzeMarket(mockMarketData);
      expect(result.shouldTrade).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.action).toBe('HOLD');
    });

    it('should handle malformed JSON response', async () => {
      const mockMalformedResponse: ChatResponse = {
        ...mockDeepSeekResponse,
        choices: [{
          message: {
            role: 'assistant',
            content: '{ "shouldTrade": true, invalid json here'
          },
          finish_reason: 'stop'
        }]
      };

      mockChatCompletionFn.mockResolvedValueOnce(mockMalformedResponse);

      const result = await aiService.analyzeMarket(mockMarketData);
      expect(result.shouldTrade).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.action).toBe('HOLD');
    });

    it('should handle empty response', async () => {
      const mockEmptyResponse: ChatResponse = {
        ...mockDeepSeekResponse,
        choices: [{
          message: {
            role: 'assistant',
            content: ''
          },
          finish_reason: 'stop'
        }]
      };

      mockChatCompletionFn.mockResolvedValueOnce(mockEmptyResponse);

      const result = await aiService.analyzeMarket(mockMarketData);
      expect(result.shouldTrade).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.action).toBe('HOLD');
    });
  });
});
