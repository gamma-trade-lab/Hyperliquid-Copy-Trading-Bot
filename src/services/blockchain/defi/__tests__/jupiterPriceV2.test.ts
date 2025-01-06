import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import axios from 'axios';
import { JupiterPriceV2 } from '../jupiterPriceV2';
import { JupiterPrice, JupiterPriceResponse } from '../../../../types/jupiter';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('JupiterPriceV2', () => {
  let jupiterPrice: JupiterPriceV2;

  beforeEach(() => {
    jupiterPrice = new JupiterPriceV2();
    jest.clearAllMocks();
  });

  describe('getPrices', () => {
    it('should fetch prices for multiple tokens', async () => {
      const mockResponse = {
        data: {
          'token1': {
            id: 'token1',
            mintSymbol: 'TKN1',
            vsToken: 'USDC',
            vsTokenSymbol: 'USDC',
            price: 1.5,
            confidence: 0.95
          },
          'token2': {
            id: 'token2',
            mintSymbol: 'TKN2',
            vsToken: 'USDC',
            vsTokenSymbol: 'USDC',
            price: 2.5,
            confidence: 0.9
          }
        }
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const result = await jupiterPrice.getPrices(['token1', 'token2']);
      expect(result.data.token1.price).toBe(1.5);
      expect(result.data.token2.price).toBe(2.5);
      expect(result.data.token1.confidence).toBeGreaterThan(0.9);
    });

    it('should handle rate limiting', async () => {
      const mockResponse = {
        data: {
          'token1': {
            price: 1.0,
            confidence: 0.9
          }
        }
      };

      mockedAxios.get.mockResolvedValue({ data: mockResponse });

      // Make multiple requests to trigger rate limiting
      const promises = Array(10).fill(null).map(() => 
        jupiterPrice.getPrices(['token1'])
      );

      await Promise.all(promises);
      expect(mockedAxios.get).toHaveBeenCalledTimes(10);
    });

    it('should filter out low confidence prices', async () => {
      const mockResponse = {
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
            'token1': {
              price: 1.0,
              confidence: 0.9
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

  describe('getPrice', () => {
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

      const price = await jupiterPrice.getPrice('token1');
      expect(price).toBe(1.5);
    });

    it('should throw error when price is not available', async () => {
      const mockResponse = {
        data: {}
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

      await expect(jupiterPrice.getPrice('token1')).rejects.toThrow(
        'No price data available for token token1'
      );
    });

    it('should handle invalid price data', async () => {
      const mockResponse = {
        data: {
          'token1': {
            price: 'invalid',
            confidence: 0.95
          }
        }
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

      await expect(jupiterPrice.getPrice('token1')).rejects.toThrow(
        'Invalid price data for token token1'
      );
    });
  });

  describe('batch processing', () => {
    it('should process token batches correctly', async () => {
      const tokens = Array(25).fill(null).map((_, i) => `token${i}`);
      const mockResponse = {
        data: tokens.reduce((acc, token) => ({
          ...acc,
          [token]: { price: 1.0, confidence: 0.9 }
        }), {})
      };

      mockedAxios.get.mockResolvedValue({ data: mockResponse });

      const result = await jupiterPrice.getPrices(tokens);
      expect(Object.keys(result.data).length).toBe(tokens.length);
      expect(mockedAxios.get).toHaveBeenCalledTimes(Math.ceil(tokens.length / 10));
    });
  });
});
