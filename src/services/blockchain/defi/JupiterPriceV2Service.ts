import axios from 'axios';
import { RedisService } from '../../../services/market/data/RedisCache';
import { elizaLogger } from "@ai16z/eliza";

// Required interfaces
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

export interface MarketMetrics {
  price: number;
  volume24h: number;
  priceChange24h: number;
  marketCap: number;
  confidenceLevel: 'high' | 'medium' | 'low';
}

export interface TokenInfo {
  id: string;
  symbol: string;
  name: string;
  price: number;
  volume24h: number;
  marketCap: number;
  address: string;
  verified: boolean;
  // Add other properties as needed
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
  private static readonly TOKENS_URL = 'https://tokens.jup.ag/tokens';
  private static readonly CACHE_TTL = 60; // 1 minute
  private static readonly MAX_RETRIES = 3;
  private static readonly DEFAULT_RATE_LIMIT = 600;
  private static readonly DEFAULT_RATE_WINDOW = 60000;

  private cache: RedisService;
  private tokenInfoCache: Map<string, TokenInfo> = new Map();
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
      enableCircuitBreaker: config?.redis?.enableCircuitBreaker ?? true
    };

    this.cache = new RedisService(redisConfig);
    this.rateLimit = config?.rateLimitConfig?.requestsPerMinute || JupiterPriceV2Service.DEFAULT_RATE_LIMIT;
    this.rateWindow = config?.rateLimitConfig?.windowMs || JupiterPriceV2Service.DEFAULT_RATE_WINDOW;

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

      const response = await axios.get(`${JupiterPriceV2Service.BASE_URL}`, {
        params: {
          ids: tokenMint,
          showExtraInfo: true
        }
      });

      const tokenPrice = response.data.data[tokenMint];
      if (!tokenPrice) return null;

      await this.cache.set(
        cacheKey,
        JSON.stringify(tokenPrice),
        JupiterPriceV2Service.CACHE_TTL
      );

      return tokenPrice;

    } catch (error) {
      elizaLogger.error('Error fetching token price:', error);
      throw error;
    }
  }

  public async getMarketMetrics(symbol: string): Promise<MarketMetrics | null> {
    try {
      const cacheKey = `metrics:${symbol}`;
      const cachedData = await this.cache.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const tokenInfo = await this.getTokenInfo(symbol);
      if (!tokenInfo) return null;

      const priceData = await this.getTokenPrice(tokenInfo.address);
      if (!priceData) return null;

      const volumeData = await this.getTokenVolume(tokenInfo.address);
      const priceChange = this.calculatePriceChange(priceData);

      const metrics: MarketMetrics = {
        price: parseFloat(priceData.price),
        volume24h: volumeData.volume24h,
        priceChange24h: priceChange,
        marketCap: this.calculateMarketCap(priceData.price, tokenInfo),
        confidenceLevel: priceData.extraInfo?.confidenceLevel || 'low'
      };

      await this.cache.set(
        cacheKey,
        JSON.stringify(metrics),
        JupiterPriceV2Service.CACHE_TTL
      );

      return metrics;

    } catch (error) {
      elizaLogger.error('Error fetching market metrics:', error);
      throw error;
    }
  }

  public async getPriceWithMetrics(symbol: string): Promise<{
    price: number;
    metrics: MarketMetrics | null;
  }> {
    try {
      const tokenInfo = await this.getTokenInfo(symbol);
      if (!tokenInfo) {
        return { price: 0, metrics: null };
      }

      const [priceData, metrics] = await Promise.all([
        this.getTokenPrice(tokenInfo.address),
        this.getMarketMetrics(symbol)
      ]);

      return {
        price: parseFloat(priceData?.price || '0'),
        metrics
      };

    } catch (error) {
      elizaLogger.error('Error fetching price with metrics:', error);
      throw error;
    }
  }

  public async getTokenInfo(symbol: string): Promise<TokenInfo | null> {
    try {
      // Check cache first
      const cacheKey = `token:${symbol}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const response = await axios.get(JupiterPriceV2Service.TOKENS_URL);
      if (!response.data || !response.data.tokens) {
        throw new Error('Invalid response from Jupiter API');
      }

      const token = response.data.tokens.find((t: TokenInfo) => 
        t.symbol.toLowerCase() === symbol.toLowerCase()
      );

      if (token) {
        // Cache the result
        await this.cache.set(cacheKey, JSON.stringify(token), 300); // 5 minutes
      }

      return token || null;
    } catch (error) {
      elizaLogger.error(`Failed to fetch info for token ${symbol}:`, error);
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
        return { volume24h: 0 };
      }

      const { buyPriceImpactRatio, sellPriceImpactRatio } = priceData.extraInfo.depth;
      const price = parseFloat(priceData.price);
      
      const volume24h = this.calculateVolume(
        price,
        buyPriceImpactRatio.depth,
        sellPriceImpactRatio.depth
      );

      const result = { volume24h };
      await this.cache.set(cacheKey, JSON.stringify(result), JupiterPriceV2Service.CACHE_TTL);

      return result;

    } catch (error) {
      elizaLogger.error('Error calculating token volume:', error);
      throw error;
    }
  }

  public async getTopMovers(): Promise<TokenInfo[]> {
    const response = await fetch(`${JupiterPriceV2Service.BASE_URL}/top-movers`);
    if (!response.ok) {
      throw new Error('Failed to fetch top movers');
    }
    const data = await response.json();
    return data.tokens as TokenInfo[];
  }

  public async getHighestVolumeTokens(): Promise<TokenInfo[]> {
    const response = await fetch(`${JupiterPriceV2Service.BASE_URL}/highest-volume`);
    if (!response.ok) {
      throw new Error('Failed to fetch highest volume tokens');
    }
    const data = await response.json();
    return data.tokens as TokenInfo[];
  }
  public async getMarketData(symbol: string): Promise<{
    price: number;
    volume24h: number;
    priceChange24h: number;
}> {
    try {
        const tokenInfo = await this.getTokenInfo(symbol);
        if (!tokenInfo) {
            elizaLogger.error(`Token not found: ${symbol}`);
            return { price: 0, volume24h: 0, priceChange24h: 0 };
        }

        const cacheKey = `market:${symbol}`;
        const cached = await this.cache.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const response = await axios.get(
            `${JupiterPriceV2Service.BASE_URL}?ids=${tokenInfo.address}&showExtraInfo=true`
        );

        if (!response.data?.data || !response.data.data[tokenInfo.address]) {
            throw new Error(`No price data found for ${symbol}`);
        }

        const priceData = response.data.data[tokenInfo.address];
        const marketData = {
            price: parseFloat(priceData.price),
            volume24h: (await this.getTokenVolume(tokenInfo.address)).volume24h,
            priceChange24h: this.calculatePriceChange(priceData)
        };

        // Cache the result
        await this.cache.set(cacheKey, JSON.stringify(marketData), JupiterPriceV2Service.CACHE_TTL);

        return marketData;
    } catch (error) {
        elizaLogger.error(`Failed to fetch market data for ${symbol}:`, error);
        throw error;
    }
}
private calculatePriceChange(priceData: TokenPrice): number {
  try {
      if (!priceData?.extraInfo?.quotedPrice) return 0;

      const currentPrice = parseFloat(priceData.price);
      const oldPrice = parseFloat(priceData.extraInfo.quotedPrice.sellPrice);
      
      if (isNaN(currentPrice) || isNaN(oldPrice) || oldPrice === 0) {
          elizaLogger.warn('Invalid price data for price change calculation');
          return 0;
      }

      const change = ((currentPrice - oldPrice) / oldPrice) * 100;
      return Number(change.toFixed(2)); // Round to 2 decimal places
  } catch (error) {
      elizaLogger.error('Error calculating price change:', error);
      return 0;
  }
}

  private calculateMarketCap(price: string, tokenInfo: TokenInfo): number {
    const priceNum = parseFloat(price);
    if (isNaN(priceNum)) return 0;
    
    const defaultSupply = 1_000_000;
    return priceNum * (tokenInfo.marketCap || defaultSupply);
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
