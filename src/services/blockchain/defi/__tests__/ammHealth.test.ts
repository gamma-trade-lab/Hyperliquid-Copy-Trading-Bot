import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { AMMHealthChecker } from '../ammHealth.js';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AMMHealthChecker', () => {
  let healthChecker: AMMHealthChecker;

  beforeEach(() => {
    healthChecker = new AMMHealthChecker();
    jest.clearAllMocks();
  });

  describe('checkHealth', () => {
    it('should return health data for specified tokens', async () => {
      const mockResponse = {
        data: {
          'dex1': {
            health: 0.9,
            volume24h: 500000,
            tvl: 1000000
          },
          'dex2': {
            health: 0.85,
            volume24h: 750000,
            tvl: 2000000
          }
        }
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const result = await healthChecker.checkHealth(['token1', 'token2']);
      const healthScore = result['token1,token2'];
      expect(healthScore).toBeGreaterThanOrEqual(0.85);
      expect(Object.keys(result).length).toBe(1);
    });

    it('should handle unhealthy AMM conditions', async () => {
      const mockResponse = {
        data: {
          'dex1': {
            health: 0.6,
            volume24h: 50000,
            tvl: 100000
          }
        }
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const result = await healthChecker.checkHealth(['token1']);
      expect(result['token1']).toBeLessThan(0.8); // Below HEALTH_THRESHOLD
      const isHealthy = await healthChecker.isHealthy(['token1']);
      expect(isHealthy).toBe(false);
    });

    it('should use cached results within cache duration', async () => {
      const mockResponse = {
        data: {
          'dex1': {
            health: 0.95,
            volume24h: 500000,
            tvl: 1000000
          }
        }
      };

      mockedAxios.get.mockResolvedValue({ data: mockResponse });

      // First call
      const result1 = await healthChecker.checkHealth(['token1']);
      // Second call should use cache
      const result2 = await healthChecker.checkHealth(['token1']);

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    it('should handle API errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API Error'));

      const result = await healthChecker.checkHealth(['token1']);
      expect(result).toEqual({});
    });

    it('should validate health thresholds correctly', async () => {
      const mockResponse = {
        data: {
          'dex1': {
            health: 0.95,
            volume24h: 500000,
            tvl: 1000000
          },
          'dex2': {
            health: 0.75,
            volume24h: 50000,
            tvl: 100000
          }
        }
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const result = await healthChecker.checkHealth(['token1', 'token2']);
      const isHealthy = await healthChecker.isHealthy(['token1', 'token2']);
      
      expect(isHealthy).toBe(false); // Because average health is below threshold
      expect(result['token1,token2']).toBeLessThan(0.8);
    });
  });
});
