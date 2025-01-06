import { getTransactionsForAddress, getNFTEvents, getTokenTransfers, getJupiterSwaps } from '../heliusIntegration';
import redisClient from '../../../config/inMemoryDB';

// Mock Redis client
jest.mock('../../../config/inMemoryDB', () => ({
  get: jest.fn(),
  set: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

describe('Helius Integration Tests', () => {
  const mockAddress = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Error Handling and Retries', () => {
    it('should retry failed API calls up to MAX_RETRIES (3) times', async () => {
      // Mock Redis cache miss
      (redisClient.get as jest.Mock).mockResolvedValueOnce(null);
      
      // Mock API failures followed by success
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('API Error 1'))
        .mockRejectedValueOnce(new Error('API Error 2'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([])
        });

      await getTransactionsForAddress(mockAddress);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw error after MAX_RETRIES attempts', async () => {
      // Mock Redis cache miss
      (redisClient.get as jest.Mock).mockResolvedValueOnce(null);
      
      // Mock consistent API failures
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Persistent API Error'));

      await expect(getTransactionsForAddress(mockAddress))
        .rejects
        .toThrow('Persistent API Error');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Redis Caching', () => {
    it('should cache API responses with 1-hour TTL (3600 seconds)', async () => {
      const mockTransactions = [{ signature: 'test_tx' }];
      
      // Mock Redis cache miss
      (redisClient.get as jest.Mock).mockResolvedValueOnce(null);
      
      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTransactions)
      });

      await getTransactionsForAddress(mockAddress);

      expect(redisClient.set).toHaveBeenCalledWith(
        `helius_${mockAddress}_100`,
        JSON.stringify(mockTransactions),
        'EX',
        3600
      );
    });

    it('should use cached data when available and not call API', async () => {
      const mockCachedData = [{ signature: 'cached_tx' }];
      
      // Mock Redis cache hit
      (redisClient.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockCachedData));

      const result = await getTransactionsForAddress(mockAddress);

      expect(result).toEqual(mockCachedData);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(redisClient.set).not.toHaveBeenCalled();
    });
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTransactionsForAddress', () => {
    it('should fetch and cache transactions', async () => {
      // Mock Redis cache miss
      (redisClient.get as jest.Mock).mockResolvedValueOnce(null);
      
      const address = 'DUSTawucrTsGU8hcuRQRQJ4N8w6B6cUWGWZtNMv2qLiA'; // Valid Solana address
      const limit = 10;
      
      try {
        const transactions = await getTransactionsForAddress(address, limit);
        expect(redisClient.set).toHaveBeenCalled();
        expect(Array.isArray(transactions)).toBeTruthy();
      } catch (error) {
        // API errors are expected in test environment
        if (error instanceof Error) {
          const errorMessage = error.message.toLowerCase();
          expect(errorMessage).toMatch(/api key|authentication|unauthorized/i);
        } else {
          throw error; // Re-throw if it's not an Error instance
        }
      }
    });

    it('should return cached data when available', async () => {
      const mockData = [{ signature: 'test', type: 'SWAP' }];
      (redisClient.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockData));
      
      const transactions = await getTransactionsForAddress('testAddress');
      expect(transactions).toEqual(mockData);
      expect(redisClient.set).not.toHaveBeenCalled();
    });
  });

  describe('getNFTEvents', () => {
    it('should filter and return NFT transactions', async () => {
      const mockData = [
        { signature: '1', type: 'NFT_SALE', description: 'NFT Sale', timestamp: Date.now() },
        { signature: '2', type: 'SWAP', description: 'Token Swap', timestamp: Date.now() }
      ];
      (redisClient.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockData));
      
      const nftEvents = await getNFTEvents('DUSTawucrTsGU8hcuRQRQJ4N8w6B6cUWGWZtNMv2qLiA');
      expect(nftEvents).toEqual([mockData[0]]); // Should only include NFT_SALE transaction
    });
  });

  describe('getTokenTransfers', () => {
    it('should filter and return token transfer transactions', async () => {
      const mockData = [
        { 
          signature: '1', 
          type: 'TRANSFER',
          tokenTransfers: [{ amount: 100, token: 'SOL' }],
          timestamp: Date.now()
        },
        { 
          signature: '2', 
          type: 'UNKNOWN',
          tokenTransfers: [],
          timestamp: Date.now()
        }
      ];
      (redisClient.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockData));
      
      const transfers = await getTokenTransfers('DUSTawucrTsGU8hcuRQRQJ4N8w6B6cUWGWZtNMv2qLiA');
      expect(transfers).toEqual([mockData[0]]); // Should only include transaction with token transfers
    });
  });

  describe('getJupiterSwaps', () => {
    it('should filter and return Jupiter swap transactions', async () => {
      const mockData = [
        { 
          signature: '1', 
          source: 'jupiter',
          type: 'SWAP',
          description: 'Jupiter Swap',
          timestamp: Date.now()
        },
        { 
          signature: '2', 
          source: 'other',
          type: 'SWAP',
          description: 'Other Swap',
          timestamp: Date.now()
        }
      ];
      (redisClient.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockData));
      
      const swaps = await getJupiterSwaps('DUSTawucrTsGU8hcuRQRQJ4N8w6B6cUWGWZtNMv2qLiA');
      expect(swaps).toEqual([mockData[0]]); // Should only include Jupiter swaps
    });
  });
});
