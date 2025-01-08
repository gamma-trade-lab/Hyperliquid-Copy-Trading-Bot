import { PriceData, TokenMetrics, VolatilityMetrics } from '../../../types/market.js';
import Redis from 'ioredis';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class DataProcessor {
  private readonly redis: Redis;
  private readonly PRICE_HISTORY_KEY = 'price_history:';
  private readonly VOLATILITY_KEY = 'volatility:';
  private readonly DEFAULT_WINDOW = 24; // 24 hours
  private readonly ERROR_THRESHOLD = 5; // Number of errors before circuit opens
  private readonly CIRCUIT_RESET_TIMEOUT = 60000; // 1 minute timeout before circuit resets
  private readonly MAX_RETRIES = 3;

  private isConnected: boolean = false;
  private errorCount: number = 0;
  private isCircuitOpen: boolean = false;
  private lastErrorTime: number = 0;

  constructor() {
    // Use Redis configuration from environment
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, {
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
    });

    // Handle Redis connection errors
    this.redis.on('error', (error: Error) => {
      console.error('Redis connection error:', error);
      this.handleRedisError(error);
    });

    // Handle Redis connection ready
    this.redis.on('ready', () => {
      console.log('Redis connection established');
      this.isConnected = true;
    });
  }

  public async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
      console.log('Redis connection closed');
    }
  }

  /**
   * Store historical price data in Redis
   */
  private async compressData<T>(data: T): Promise<string> {
    const jsonString = JSON.stringify(data);
    const compressed = await gzip(jsonString);
    return compressed.toString('base64');
  }

  private async decompressData<T>(data: string): Promise<T> {
    const buffer = Buffer.from(data, 'base64');
    const decompressed = await gunzip(buffer);
    return JSON.parse(decompressed.toString()) as T;
  }

  private checkCircuitBreaker(): boolean {
    const now = Date.now();
    if (now - this.lastErrorTime > this.CIRCUIT_RESET_TIMEOUT) {
      this.errorCount = 0;
      this.isCircuitOpen = false;
    }
    return this.isCircuitOpen;
  }

  private handleRedisError(error: Error): void {
    this.isConnected = false;
    console.error('Redis error occurred:', error);
    
    this.errorCount++;
    if (this.errorCount >= this.ERROR_THRESHOLD) {
      this.isCircuitOpen = true;
      console.warn('Circuit breaker opened due to Redis errors');
      
      setTimeout(() => {
        this.isCircuitOpen = false;
        this.errorCount = 0;
        console.log('Circuit breaker reset');
      }, this.CIRCUIT_RESET_TIMEOUT);
    }
  }

  public async storePriceData(token: string, data: PriceData): Promise<void> {
    try {
      const key = `${this.PRICE_HISTORY_KEY}${token}`;
      const compressed = await this.compressData(data);
      await this.redis.lpush(key, compressed);
      await this.redis.ltrim(key, 0, this.DEFAULT_WINDOW * 60); // Keep last 24 hours of minute data
      
      // Reset error count on successful operation
      this.errorCount = 0;
      this.isCircuitOpen = false;
    } catch (error) {
      console.error(`Failed to store price data for ${token}:`, error);
      this.errorCount++;
      this.lastErrorTime = Date.now();
      this.handleRedisError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get historical price data from Redis
   */
  public async getHistoricalPrices(token: string, hours: number = this.DEFAULT_WINDOW): Promise<PriceData[]> {
    try {
      if (this.checkCircuitBreaker()) {
        console.warn('Circuit breaker open, using cached data only');
        return [];
      }

      const key = `${this.PRICE_HISTORY_KEY}${token}`;
      const data = await this.redis.lrange(key, 0, hours * 60 - 1);
      const decompressedData = await Promise.all(
        data.map(async item => this.decompressData<PriceData>(item))
      );
      
      // Reset error count on successful operation
      this.errorCount = 0;
      this.isCircuitOpen = false;
      return decompressedData;
    } catch (error) {
      console.error(`Failed to get historical prices for ${token}:`, error);
      this.errorCount++;
      this.lastErrorTime = Date.now();
      this.handleRedisError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Calculate and store average volatility
   */
  public async updateAverageVolatility(token: string, currentVolatility: number): Promise<void> {
    try {
      const key = `${this.VOLATILITY_KEY}${token}`;
      const stored = await this.redis.get(key);
      const current = stored ? await this.decompressData<{ sum: number; count: number }>(stored) : { sum: 0, count: 0 };
      
      current.sum += currentVolatility;
      current.count += 1;

      const compressed = await this.compressData(current);
      await this.redis.set(key, compressed);
      
      this.errorCount = 0;
      this.isCircuitOpen = false;
    } catch (error) {
      console.error(`Failed to update volatility for ${token}:`, error);
      this.errorCount++;
      this.lastErrorTime = Date.now();
      this.handleRedisError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get average volatility for a token
   */
  public async getAverageVolatility(token: string): Promise<number> {
    try {
      if (this.checkCircuitBreaker()) {
        console.warn('Circuit breaker open, using default volatility');
        return 0;
      }

      const key = `${this.VOLATILITY_KEY}${token}`;
      const stored = await this.redis.get(key);
      if (!stored) return 0;

      const { sum, count } = await this.decompressData<{ sum: number; count: number }>(stored);
      this.errorCount = 0;
      this.isCircuitOpen = false;
      return count > 0 ? sum / count : 0;
    } catch (error) {
      console.error(`Failed to get volatility for ${token}:`, error);
      this.errorCount++;
      this.lastErrorTime = Date.now();
      this.handleRedisError(error instanceof Error ? error : new Error(String(error)));
      return 0; // Return safe default on error
    }
  }

  /**
   * Calculate token metrics from historical data
   */
  public async calculateTokenMetrics(token: string): Promise<TokenMetrics> {
    try {
      if (this.isCircuitOpen) {
        console.warn('Circuit breaker open, using cached or default metrics');
        const cachedMetrics = await this.redis.get(`metrics:${token}`);
        if (cachedMetrics) {
          return this.decompressData<TokenMetrics>(cachedMetrics);
        }
        return {
          price: 0,
          volume24h: 0,
          priceChange24h: 0,
          volatility: 0
        };
      }


      const prices = await this.getHistoricalPrices(token);
      if (!prices.length) {
        return {
          price: 0,
          volume24h: 0,
          priceChange24h: 0,
          volatility: 0
        };
      }

      const currentPrice = prices[0].close;
      const volume24h = prices.reduce((sum, data) => sum + data.volume, 0);
      const priceChange24h = prices.length > 1 
        ? ((currentPrice - prices[prices.length - 1].close) / prices[prices.length - 1].close) * 100
        : 0;
      const volatility = await this.getAverageVolatility(token);

      const metrics = {
        price: currentPrice,
        volume24h,
        priceChange24h,
        volatility
      };

      // Cache the metrics
      const compressed = await this.compressData(metrics);
      await this.redis.set(`metrics:${token}`, compressed, 'EX', 300); // Cache for 5 minutes
      
      this.errorCount = 0;
      this.isCircuitOpen = false;
      return metrics;
    } catch (error) {
      console.error(`Failed to calculate metrics for ${token}:`, error);
      this.errorCount++;
      this.lastErrorTime = Date.now();
      this.handleRedisError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get current token price
   */
  public async getTokenPrice(token: string): Promise<number> {
    try {
      if (this.isCircuitOpen) {
        console.warn('Circuit breaker open, using cached price');
        const cachedPrice = await this.redis.get(`price:${token}`);
        if (cachedPrice) {
          return (await this.decompressData<{ price: number }>(cachedPrice)).price;
        }
        throw new Error('No cached price available');
      }

      const prices = await this.getHistoricalPrices(token, 1); // Get last hour of data
      if (!prices.length) {
        throw new Error(`No price data available for token ${token}`);
      }

      const price = prices[0].close;
      
      // Cache the current price
      await this.redis.set(
        `price:${token}`, 
        await this.compressData({ price }), 
        'EX', 
        60 // Cache for 1 minute
      );
      
      this.errorCount = 0;
      this.isCircuitOpen = false;
      return price;
    } catch (error) {
      console.error(`Failed to get price for ${token}:`, error);
      this.errorCount++;
      this.lastErrorTime = Date.now();
      this.handleRedisError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}
