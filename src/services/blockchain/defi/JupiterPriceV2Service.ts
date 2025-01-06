import axios from 'axios';
import { RedisCache } from '../../../services/market/data/RedisCache';
import { JupiterPriceResponse, TokenPrice, MarketDepth, PriceImpact, TokenMetrics } from './types';

export class JupiterPriceV2Service {
  private static readonly BASE_URL = 'https://price.jup.ag/v2';
  private static readonly BATCH_SIZE = 100;
  private static readonly MIN_CONFIDENCE = 0.5;
  private static readonly CACHE_TTL = 300; // 5 minutes
  private static readonly MAX_RETRIES = 3;
  private static readonly RATE_LIMIT = 600; // requests per minute
  private static readonly RATE_WINDOW = 60000; // 1 minute in milliseconds

  private cache: RedisCache;
  private requestCount: number;
  private windowStart: number;

  constructor() {
    this.cache = new RedisCache('jupiter');
    this.requestCount = 0;
    this.windowStart = Date.now();
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    if (now - this.windowStart >= JupiterPriceV2Service.RATE_WINDOW) {
      // Reset window
      this.windowStart = now;
      this.requestCount = 0;
    }

    if (this.requestCount >= JupiterPriceV2Service.RATE_LIMIT) {
      const waitTime = JupiterPriceV2Service.RATE_WINDOW - (now - this.windowStart);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.windowStart = Date.now();
      this.requestCount = 0;
    }

    this.requestCount++;
  }

  public async getPrices(tokenMints: string[]): Promise<JupiterPriceResponse> {
    // Split into batches of 100 tokens (Jupiter API limit)
    const batches: string[][] = [];
    for (let i = 0; i < tokenMints.length; i += JupiterPriceV2Service.BATCH_SIZE) {
      batches.push(tokenMints.slice(i, i + JupiterPriceV2Service.BATCH_SIZE));
    }

    const responses = await Promise.all(
      batches.map(async (batch) => {
        const cacheKey = `prices:${batch.join(',')}`;
        const cachedData = await this.cache.get(cacheKey);

        if (cachedData) {
          return JSON.parse(cachedData);
        }

        let retries = 0;
        while (retries < JupiterPriceV2Service.MAX_RETRIES) {
          try {
            const response = await axios.get<JupiterPriceResponse>(
              `${JupiterPriceV2Service.BASE_URL}/price`,
              {
                params: {
                  ids: batch.join(','),
                },
              }
            );

            await this.cache.set(
              cacheKey,
              JSON.stringify(response.data),
              JupiterPriceV2Service.CACHE_TTL
            );

            return response.data;
          } catch (error) {
            retries++;
            if (retries === JupiterPriceV2Service.MAX_RETRIES) {
              console.error('Max retries reached for Jupiter price fetch:', error);
              throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
          }
        }
      })
    );

    // Merge responses
    const mergedData: JupiterPriceResponse = {
      data: responses.reduce((acc, response) => ({
        ...acc,
        ...response.data,
      }), {}),
    };

    // Filter out low confidence prices
    Object.keys(mergedData.data).forEach(key => {
      if (mergedData.data[key].confidence < JupiterPriceV2Service.MIN_CONFIDENCE) {
        console.warn(`Low confidence price for token ${key}: ${mergedData.data[key].confidence}`);
        delete mergedData.data[key];
      }
    });

    return mergedData;
  }

  public async getTokenMetrics(tokenMint: string): Promise<TokenMetrics> {
    const cacheKey = `metrics:${tokenMint}`;
    const cachedData = await this.cache.get(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const priceResponse = await this.getPrices([tokenMint]);
    const tokenData = priceResponse.data[tokenMint];

    if (!tokenData) {
      throw new Error(`No price data found for token ${tokenMint}`);
    }

    const metrics: TokenMetrics = {
      price: {
        price: tokenData.price,
        confidence: tokenData.confidence,
        timestamp: Date.now(),
      },
      lastUpdate: Date.now(),
    };

    await this.cache.set(
      cacheKey,
      JSON.stringify(metrics),
      JupiterPriceV2Service.CACHE_TTL
    );

    return metrics;
  }

  public async calculatePriceImpact(
    tokenMint: string,
    amount: number
  ): Promise<PriceImpact> {
    const cacheKey = `impact:${tokenMint}:${amount}`;
    const cachedData = await this.cache.get(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    try {
      const response = await axios.get(
        `${JupiterPriceV2Service.BASE_URL}/price`,
        {
          params: {
            id: tokenMint,
            amount,
          },
        }
      );

      const impact: PriceImpact = {
        buyImpact: response.data.data[tokenMint].priceImpact?.buy || 0,
        sellImpact: response.data.data[tokenMint].priceImpact?.sell || 0,
        timestamp: Date.now(),
      };

      await this.cache.set(
        cacheKey,
        JSON.stringify(impact),
        JupiterPriceV2Service.CACHE_TTL
      );

      return impact;
    } catch (error) {
      console.error('Error calculating price impact:', error);
      throw error;
    }
  }

  public async getMarketDepth(
    tokenMint: string,
    limit: number = 10
  ): Promise<MarketDepth> {
    const cacheKey = `depth:${tokenMint}:${limit}`;
    const cachedData = await this.cache.get(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    try {
      const response = await axios.get(
        `${JupiterPriceV2Service.BASE_URL}/orderbook`,
        {
          params: {
            id: tokenMint,
            limit,
          },
        }
      );

      const depth: MarketDepth = {
        bids: response.data.bids.map((bid: any) => ({
          price: bid.price,
          size: bid.size,
        })),
        asks: response.data.asks.map((ask: any) => ({
          price: ask.price,
          size: ask.size,
        })),
      };

      await this.cache.set(
        cacheKey,
        JSON.stringify(depth),
        JupiterPriceV2Service.CACHE_TTL
      );

      return depth;
    } catch (error) {
      console.error('Error fetching market depth:', error);
      throw error;
    }
  }
}
