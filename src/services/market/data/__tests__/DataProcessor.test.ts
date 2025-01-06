import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { DataProcessor } from '../DataProcessor';
import Redis from 'ioredis';
import { PriceData, TokenMetrics } from '../../../../types/market';
import * as zlib from 'zlib';
import { promisify } from 'util';

// Mock Redis and zlib
jest.mock('ioredis');
jest.mock('zlib');

const mockRedis = Redis as jest.Mocked<typeof Redis>;

// Helper function to create mock compressed data
const createMockCompressedData = async (data: any): Promise<string> => {
  const jsonStr = JSON.stringify(data);
  const buffer = Buffer.from(jsonStr);
  return buffer.toString('base64');
};

describe('DataProcessor', () => {
  let dataProcessor: DataProcessor;
  // Define mock functions with proper Redis method types
  let mockGet: jest.MockedFunction<Redis['get']>;
  let mockSet: jest.MockedFunction<Redis['set']>;
  let mockLpush: jest.MockedFunction<Redis['lpush']>;
  let mockLtrim: jest.MockedFunction<Redis['ltrim']>;
  let mockLrange: jest.MockedFunction<Redis['lrange']>;
  let mockRedisInstance: jest.Mocked<Redis>;

  beforeAll(() => {
    // Mock Redis constructor
    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedisInstance);
  });

  afterAll(async () => {
    // Clean up Redis connection
    if (dataProcessor) {
      await dataProcessor.disconnect();
    }
    jest.resetModules();
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup Redis mock methods with proper typing
    mockGet = jest.fn(async (key: string) => null) as jest.MockedFunction<Redis['get']>;
    mockSet = jest.fn(async (key: string, value: string, ...args: any[]) => 'OK') as jest.MockedFunction<Redis['set']>;
    mockLpush = jest.fn(async (key: string, ...values: string[]) => 1) as jest.MockedFunction<Redis['lpush']>;
    mockLtrim = jest.fn(async (key: string, start: number, stop: number) => 'OK') as jest.MockedFunction<Redis['ltrim']>;
    mockLrange = jest.fn(async (key: string, start: number, stop: number) => []) as jest.MockedFunction<Redis['lrange']>;

    // Create a properly typed mock Redis instance
    mockRedisInstance = {
      get: mockGet,
      set: mockSet,
      lpush: mockLpush,
      ltrim: mockLtrim,
      lrange: mockLrange,
      on: jest.fn(),
      options: {},
      status: 'ready',
      stream: {} as any,
      isCluster: false,
      disconnect: jest.fn(),
      quit: jest.fn(),
      connect: jest.fn(),
      duplicate: jest.fn(),
    } as unknown as jest.Mocked<Redis>;

    // Configure Redis mock
    jest.mocked(Redis).mockImplementation(() => mockRedisInstance);

    dataProcessor = new DataProcessor();
  });

  describe('storePriceData', () => {
    it('should store and compress price data', async () => {
      const token = 'SOL';
      const priceData = {
        timestamp: Date.now(),
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: 1000000
      };

      mockLpush.mockImplementation(async () => 1);
      mockLtrim.mockImplementation(async () => 'OK');

      await dataProcessor.storePriceData(token, priceData);

      expect(mockLpush).toHaveBeenCalled();
      expect(mockLtrim).toHaveBeenCalled();
    });
  });

  describe('getHistoricalPrices', () => {
    it('should retrieve and decompress historical prices', async () => {
      const token = 'SOL';
      const mockData = ['compressed_data_1', 'compressed_data_2'];
      mockLrange.mockImplementation(async () => mockData);

      const result = await dataProcessor.getHistoricalPrices(token);

      expect(mockLrange).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle circuit breaker', async () => {
      const token = 'SOL';
      
      // Simulate multiple failures
      mockLrange.mockImplementation(async () => { throw new Error('Redis error'); });
      
      // Make multiple failed calls to trigger circuit breaker
      for (let i = 0; i < 4; i++) {
        try {
          await dataProcessor.getHistoricalPrices(token);
        } catch (error) {
          // Expected errors
        }
      }

      const result = await dataProcessor.getHistoricalPrices(token);
      expect(result).toEqual([]);
    });
  });

  describe('calculateTokenMetrics', () => {
    it('should calculate metrics from historical data', async () => {
      const token = 'SOL';
      const mockPrices = [
        { timestamp: Date.now(), open: 100, high: 105, low: 95, close: 102, volume: 1000000 },
        { timestamp: Date.now() - 3600000, open: 98, high: 103, low: 97, close: 100, volume: 900000 }
      ];

      mockLrange.mockImplementation(async () => mockPrices.map(p => JSON.stringify(p)));
      mockGet.mockImplementation(async () => null); // No cached volatility

      const metrics = await dataProcessor.calculateTokenMetrics(token);

      expect(metrics).toHaveProperty('price');
      expect(metrics).toHaveProperty('volume24h');
      expect(metrics).toHaveProperty('priceChange24h');
      expect(metrics).toHaveProperty('volatility');
    });
  });

  describe('getTokenPrice', () => {
    it('should get current token price', async () => {
      const token = 'SOL';
      const mockPrices = [
        { timestamp: Date.now(), open: 100, high: 105, low: 95, close: 102, volume: 1000000 }
      ];

      mockLrange.mockImplementation(async () => mockPrices.map(p => JSON.stringify(p)));
      mockGet.mockImplementation(async () => null); // No cached price

      const price = await dataProcessor.getTokenPrice(token);

      expect(typeof price).toBe('number');
      expect(price).toBeGreaterThan(0);
    });

    it('should use cached price when circuit breaker is open', async () => {
      const token = 'SOL';
      const cachedPrice = 100;
      
      mockGet.mockImplementation(async () => JSON.stringify({ price: cachedPrice }));
      
      // Simulate multiple failures to trigger circuit breaker
      mockLrange.mockImplementation(async () => { throw new Error('Redis error'); });
      for (let i = 0; i < 4; i++) {
        try {
          await dataProcessor.getTokenPrice(token);
        } catch (error) {
          // Expected errors
        }
      }

      // Should now use cached price
      const price = await dataProcessor.getTokenPrice(token);
      expect(price).toBe(cachedPrice);
    });
  });
});
