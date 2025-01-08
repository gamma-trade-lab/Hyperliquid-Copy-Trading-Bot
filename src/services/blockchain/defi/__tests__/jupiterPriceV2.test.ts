import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import axios from 'axios';
import { JupiterPriceV2Service } from '../JupiterPriceV2Service.js';
import { RedisCache } from '../../../market/data/RedisCache.js';
import type { JupiterPriceResponse } from '../types.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Define mock response types
interface MockTokenData {
  price: number;
  confidence: number;
}

interface MockResponse {
  data: {
    [key: string]: MockTokenData | {
      [key: string]: MockTokenData;
    };
  };
}

// Mock Redis cache with proper types
const mockGet = jest.fn();
const mockSet = jest.fn();

jest.mock('../../../market/data/RedisCache.js', () => ({
  default: {
    RedisCache: jest.fn().mockImplementation(() => ({
      get: mockGet,
      set: mockSet
    }))
  }
}));

// Setup mock implementations in beforeEach
beforeEach(() => {
  mockGet.mockImplementation(() => Promise.resolve(null));
  mockSet.mockImplementation(() => Promise.resolve('OK'));
});

describe('JupiterPriceV2Service', () => {
  let jupiterPrice: JupiterPriceV2Service;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReset();
    mockSet.mockReset();
    mockGet.mockImplementation(() => Promise.resolve(null));
    mockSet.mockImplementation(() => Promise.resolve('OK'));
    jupiterPrice = new JupiterPriceV2Service();
  });

  describe('getPrices', () => {
    it('should fetch prices for multiple tokens', async () => {
      const mockResponse: MockResponse = {
        data: {
          token1: {
            price: 1.5,
            confidence: 0.95
          },
          token2: {
            price: 2.5,
            confidence: 0.9
          }
        }
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse } as any);

      const result = await jupiterPrice.getPrices(['token1', 'token2']);
      expect(result.data.token1.price).toBe(1.5);
      expect(result.data.token2.price).toBe(2.5);
      expect(result.data.token1.confidence).toBeGreaterThan(0.9);
    });

    it('should respect rate limit of 600 requests per minute', async () => {
      const mockResponse: MockResponse = {
        data: {
          data: {
            'token1': {
              price: 1.0,
              confidence: 0.9
            }
          }
        }
      };

      mockedAxios.get.mockResolvedValue({ data: mockResponse } as any);
      mockGet.mockImplementation(() => Promise.resolve(null)); // Ensure cache misses

      const batchSize = 100;
      const totalRequests = 601;
      const start = Date.now();
      
      // Make requests in smaller batches to avoid memory issues
      for (let i = 0; i < totalRequests; i += batchSize) {
        const batchPromises = Array(Math.min(batchSize, totalRequests - i))
          .fill(null)
          .map(() => jupiterPrice.getPrices(['token1']));
        await Promise.all(batchPromises);
      }
      
      const duration = Date.now() - start;

      // Should take at least 60 seconds due to rate limiting
      expect(duration).toBeGreaterThanOrEqual(60000);
      expect(mockedAxios.get).toHaveBeenCalledTimes(totalRequests);
      expect(mockSet).toHaveBeenCalled();
    });

    it('should cache responses for 5 minutes (300 seconds)', async () => {
      const mockResponse: MockResponse = {
        data: {
          data: {
            'token1': {
              price: 1.0,
              confidence: 0.9
            }
          }
        }
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

      // First request should hit API
      await jupiterPrice.getPrices(['token1']);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      // Second request within 5 minutes should use cache
      await jupiterPrice.getPrices(['token1']);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      // Verify cache TTL was set to 300 seconds
      expect(mockSet).toHaveBeenCalledWith(
        expect.stringContaining('prices:'),
        expect.any(String),
        300
      );
    });

    it('should filter out low confidence prices', async () => {
      const mockResponse: MockResponse = {
        data: {
          data: {
            'token1': {
              price: 1.0,
              confidence: 0.2 // Low confidence
            },
            'token2': {
              price: 2.0,
              confidence: 0.9 // High confidence
            }
          }
        }
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const result = await jupiterPrice.getPrices(['token1', 'token2']);
      expect(result.data.token1).toBeUndefined();
      expect(result.data.token2).toBeDefined();
      expect(result.data.token2.confidence).toBeGreaterThan(0.8);
    });

    it('should handle API errors with retries', async () => {
      mockedAxios.get
        .mockRejectedValueOnce(new Error('API Error'))
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({
          data: {
            data: {
              'token1': {
                price: 1.0,
                confidence: 0.9
              }
            }
          }
        });

      const result = await jupiterPrice.getPrices(['token1']);
      expect(result.data.token1.price).toBe(1.0);
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    });

    it('should handle network timeouts', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network timeout'));

      await expect(jupiterPrice.getPrices(['token1'])).rejects.toThrow('Failed to fetch prices');
    });
  });

  describe('single token price fetching', () => {
    it('should fetch price for a single token', async () => {
      const mockResponse = {
        data: {
          'token1': {
            price: 1.5,
            confidence: 0.95
          }
        }
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const result = await jupiterPrice.getPrices(['token1']);
      expect(result.data.token1.price).toBe(1.5);
      expect(result.data.token1.confidence).toBe(0.95);
    });

    it('should handle missing token data', async () => {
      const mockResponse = {
        data: {}
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const result = await jupiterPrice.getPrices(['token1']);
      expect(Object.keys(result.data)).toHaveLength(0);
    });

    it('should filter invalid price data', async () => {
      const mockResponse = {
        data: {
          'token1': {
            price: null,
            confidence: 0.95
          }
        }
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const result = await jupiterPrice.getPrices(['token1']);
      expect(Object.keys(result.data)).toHaveLength(0);
    });
  });

  describe('batch processing', () => {
    it('should process token batches of 100 correctly', async () => {
      const tokens = Array(250).fill(null).map((_, i) => `token${i}`);
      const mockResponse: MockResponse = {
        data: {
          data: tokens.reduce((acc, token) => ({
            ...acc,
            [token]: { price: 1.0, confidence: 0.9 }
          }), {})
        }
      };

      mockGet.mockReturnValue(Promise.resolve(null)); // Ensure cache miss
      mockedAxios.get.mockReturnValue(Promise.resolve({ data: mockResponse }));

      const result = await jupiterPrice.getPrices(tokens);
      
      // Verify results
      expect(Object.keys(result.data).length).toBe(tokens.length);
      
      // Should make exactly 3 API calls (250 tokens split into 100, 100, 50)
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
      
      // Verify batch sizes in API calls
      const calls = mockedAxios.get.mock.calls;
      expect(calls?.[0]?.[1]?.params?.ids?.split(',')?.length ?? 0).toBe(100); // First batch
      expect(calls?.[1]?.[1]?.params?.ids?.split(',')?.length ?? 0).toBe(100); // Second batch
      expect(calls?.[2]?.[1]?.params?.ids?.split(',')?.length ?? 0).toBe(50);  // Last batch
      
      // Verify caching
      expect(mockSet).toHaveBeenCalledTimes(3);
    });

    it('should handle network errors with retries', async () => {
      const tokens = ['token1'];
      mockGet.mockReturnValue(Promise.resolve(null));
      mockedAxios.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          data: {
            data: {
              'token1': { price: 1.0, confidence: 0.9 }
            }
          }
        });

      const result = await jupiterPrice.getPrices(tokens);
      expect(result.data['token1'].price).toBe(1.0);
      expect(mockedAxios.get).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should filter out low confidence prices', async () => {
      const tokens = ['token1', 'token2'];
      const mockResponse = {
        data: {
          'token1': { price: 1.0, confidence: 0.4 }, // Below threshold
          'token2': { price: 2.0, confidence: 0.9 }  // Above threshold
        }
      };

      mockGet.mockImplementation(() => Promise.resolve(null));
      mockedAxios.get.mockImplementation(() => Promise.resolve({ data: mockResponse } as any));

      const result = await jupiterPrice.getPrices(tokens);
      expect(Object.keys(result.data)).toHaveLength(1);
      expect(result.data['token1']).toBeUndefined();
      expect(result.data['token2']).toBeDefined();
      expect(result.data['token2'].price).toBe(2.0);
    });
  });
});
