import axios from 'axios';
import { RedisService } from '../../../services/market/data/RedisCache';
import { elizaLogger } from "@ai16z/eliza";
import Redis from 'ioredis';

export interface TokenPrice {
  id: string;
  type: string;
  price: string;
  extraInfo?: {
    lastSwappedPrice?: {
      lastJupiterSellAt: number;
      lastJupiterSellPrice: string;
      lastJupiterBuyAt: number;
      lastJupiterBuyPrice: string;
    };
    quotedPrice?: {
      buyPrice: string;
      buyAt: number;
      sellPrice: string;
      sellAt: number;
    };
    confidenceLevel: 'high' | 'medium' | 'low';
    depth?: {
      buyPriceImpactRatio: {
        depth: Record<string, number>;
        timestamp: number;
      };
      sellPriceImpactRatio: {
        depth: Record<string, number>;
        timestamp: number;
      };
    };
  };
}

export interface JupiterPriceResponse {
  data: {
    [key: string]: TokenPrice;
  };
  timeTaken: number;
}

export interface JupiterPriceServiceConfig {
  redis: {
    host?: string;
    port?: number;
    password?: string;
    keyPrefix?: string;
    enableCircuitBreaker?: boolean;
  };
  rateLimitConfig?: {
    requestsPerMinute?: number;
    windowMs?: number;
  };
}

export class JupiterPriceV2Service {
  private static readonly BASE_URL = 'https://api.jup.ag/price/v2';
  private static readonly CACHE_TTL = 60; // 1 minute
  private static readonly MAX_RETRIES = 3;
  private static readonly DEFAULT_RATE_LIMIT = 600; // requests per minute
  private static readonly DEFAULT_RATE_WINDOW = 60000; // 1 minute in ms
  
  private cache: RedisService;
  private requestCount: number = 0;
  private windowStart: number = Date.now();
  private readonly rateLimit: number;
  private readonly rateWindow: number;

  constructor(config?: JupiterPriceServiceConfig) {
    const redisConfig = {
      host: config?.redis?.host || 'localhost',
      port: config?.redis?.port || 6379,
      password: config?.redis?.password,
      keyPrefix: config?.redis?.keyPrefix || 'jupiter-price:',
      enableCircuitBreaker: config?.redis?.enableCircuitBreaker ?? true,
      circuitBreakerOptions: {
        failureThreshold: 5,
        resetTimeout: 30000
      }
    };

    this.cache = new RedisService(redisConfig);
    this.rateLimit = config?.rateLimitConfig?.requestsPerMinute || JupiterPriceV2Service.DEFAULT_RATE_LIMIT;
    this.rateWindow = config?.rateLimitConfig?.windowMs || JupiterPriceV2Service.DEFAULT_RATE_WINDOW;

    // Initialize Redis connection
    this.initializeCache().catch(error => {
      elizaLogger.error('Failed to initialize Redis cache:', error);
      throw error;
    });
  }

  private async initializeCache(): Promise<void> {
    try {
      await this.cache.connect();
      elizaLogger.info('Jupiter price cache initialized successfully');
    } catch (error) {
      elizaLogger.error('Failed to initialize Jupiter price cache:', error);
      throw error;
    }
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    if (now - this.windowStart >= this.rateWindow) {
      this.windowStart = now;
      this.requestCount = 0;
    }

    if (this.requestCount >= this.rateLimit) {
      const waitTime = this.rateWindow - (now - this.windowStart);
      elizaLogger.info(`Rate limit reached. Waiting ${waitTime}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.windowStart = Date.now();
    }

    this.requestCount++;
  }

  public async getTokenPrice(tokenMint: string): Promise<TokenPrice | null> {
    try {
      const cacheKey = `price:${tokenMint}`;
      const cachedData = await this.cache.get(cacheKey);

      if (cachedData) {
        return JSON.parse(cachedData);
      }

      await this.checkRateLimit();

      const response = await axios.get<JupiterPriceResponse>(
        `${JupiterPriceV2Service.BASE_URL}`,
        {
          params: {
            ids: tokenMint,
            showExtraInfo: true
          }
        }
      );

      const tokenPrice = response.data.data[tokenMint];
      
      if (!tokenPrice) {
        elizaLogger.warn(`No price data found for token ${tokenMint}`);
        return null;
      }

      if (tokenPrice.extraInfo?.confidenceLevel === 'low') {
        elizaLogger.warn(`Low confidence price for token ${tokenMint}`);
      }

      await this.cache.set(
        cacheKey,
        JSON.stringify(tokenPrice),
        JupiterPriceV2Service.CACHE_TTL
      );

      elizaLogger.info('Jupiter price fetched successfully', {
        token: tokenMint,
        price: tokenPrice.price,
        confidence: tokenPrice.extraInfo?.confidenceLevel
      });

      return tokenPrice;

    } catch (error) {
      elizaLogger.error('Error fetching Jupiter price:', error);
      throw error;
    }
  }

  public async getTokensPrice(tokenMints: string[]): Promise<JupiterPriceResponse> {
    try {
      const cacheKey = `prices:${tokenMints.sort().join(',')}`;
      const cachedData = await this.cache.get(cacheKey);

      if (cachedData) {
        return JSON.parse(cachedData);
      }

      await this.checkRateLimit();

      const response = await axios.get<JupiterPriceResponse>(
        `${JupiterPriceV2Service.BASE_URL}`,
        {
          params: {
            ids: tokenMints.join(','),
            showExtraInfo: true
          }
        }
      );

      await this.cache.set(
        cacheKey,
        JSON.stringify(response.data),
        JupiterPriceV2Service.CACHE_TTL
      );

      return response.data;

    } catch (error) {
      elizaLogger.error('Error fetching Jupiter prices:', error);
      throw error;
    }
  }

  public async getTokenVolume(tokenMint: string): Promise<{ volume24h: number }> {
    try {
      const cacheKey = `volume:${tokenMint}`;
      const cachedData = await this.cache.get(cacheKey);

      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const priceData = await this.getTokenPrice(tokenMint);
      
      if (!priceData || !priceData.extraInfo?.depth) {
        throw new Error('No depth data available');
      }

      const { buyPriceImpactRatio, sellPriceImpactRatio } = priceData.extraInfo.depth;
      const price = parseFloat(priceData.price);
      
      const volume24h = this.calculateVolume(
        price,
        buyPriceImpactRatio.depth,
        sellPriceImpactRatio.depth
      );

      const result = { volume24h };

      await this.cache.set(
        cacheKey,
        JSON.stringify(result),
        JupiterPriceV2Service.CACHE_TTL
      );

      return result;

    } catch (error) {
      elizaLogger.error('Error calculating token volume:', error);
      throw error;
    }
  }

  private calculateVolume(
    price: number,
    buyDepth: Record<string, number>,
    sellDepth: Record<string, number>
  ): number {
    const volumes = Object.keys(buyDepth).map(depth => {
      const amount = parseFloat(depth);
      const buyImpact = buyDepth[depth];
      const sellImpact = sellDepth[depth] || 0;
      const avgImpact = (buyImpact + sellImpact) / 2;
      return amount * price * (1 - avgImpact);
    });

    return volumes.reduce((sum, vol) => sum + vol, 0);
  }
}