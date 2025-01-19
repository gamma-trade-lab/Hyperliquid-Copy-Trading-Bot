import logger from "./logger";


// Types
interface TokenPrice {
  volume: number;
  price: number;
  price_change_24h: number;
  market_cap: number;
  last_updated?: string;
}

interface TrendingToken {
  id: string;
  name: string;
  symbol: string;
  price: number;
  price_change_24h: number;
  market_cap?: number;
  volume_24h?: number;
}

interface CoinGeckoError extends Error {
  status?: number;
  code?: string;
}

// Rate limiter configuration
const RATE_LIMIT_CONFIG = {
  minInterval: 1200, // 1.2 seconds between requests for safety
  maxRetries: 3,
  backoffMultiplier: 2,
  baseBackoffMs: 1000,
} as const;

// Cache configuration
const CACHE_CONFIG = {
  priceTTL: 30000, // 30 seconds
  trendingTTL: 60000, // 1 minute
} as const;

// Simple cache implementation
class Cache<T> {
  private store = new Map<string, { data: T; timestamp: number }>();

  set(key: string, data: T, ttl: number): void {
    this.store.set(key, {
      data,
      timestamp: Date.now() + ttl
    });
  }

  get(key: string): T | null {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.timestamp) {
      this.store.delete(key);
      return null;
    }
    return item.data;
  }

  clear(): void {
    this.store.clear();
  }
}

// Initialize caches
const priceCache = new Cache<TokenPrice>();
const trendingCache = new Cache<TrendingToken[]>();

// Rate limiter with exponential backoff
class RateLimiter {
  private lastRequest: number = 0;
  private retryCount: number = 0;

  async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;

    if (timeSinceLastRequest < RATE_LIMIT_CONFIG.minInterval) {
      const delay = RATE_LIMIT_CONFIG.minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequest = Date.now();
  }

  async handleError(error: CoinGeckoError): Promise<void> {
    this.retryCount++;

    if (this.retryCount > RATE_LIMIT_CONFIG.maxRetries) {
      this.retryCount = 0;
      throw error;
    }

    const backoffTime = 
      RATE_LIMIT_CONFIG.baseBackoffMs * 
      Math.pow(RATE_LIMIT_CONFIG.backoffMultiplier, this.retryCount);

    await new Promise(resolve => setTimeout(resolve, backoffTime));
  }

  reset(): void {
    this.retryCount = 0;
  }
}

const rateLimiter = new RateLimiter();

/**
 * Fetch Solana price from CoinGecko
 */
export async function getSolanaPrice(): Promise<TokenPrice> {
  // Check cache first
  const cached = priceCache.get('solana');
  if (cached) return cached;

  try {
    await rateLimiter.throttle();

    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true&include_market_cap=true',
      {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      }
    );

    if (response.status === 429) {
      const error = new Error('RATE_LIMIT') as CoinGeckoError;
      error.status = 429;
      throw error;
    }

    if (!response.ok) {
      const error = new Error(`HTTP_ERROR_${response.status}`) as CoinGeckoError;
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    
    if (!data.solana) {
      throw new Error('Invalid response format');
    }

    const price = {
      price: data.solana.usd || 0,
      price_change_24h: data.solana.usd_24h_change || 0,
      market_cap: data.solana.usd_market_cap || 0,
      volume: data.solana.usd_24h_vol || 0,
      last_updated: new Date().toISOString()
    };

    // Cache the result
    priceCache.set('solana', price, CACHE_CONFIG.priceTTL);
    rateLimiter.reset();

    return price;
  } catch (error) {
    logger.error('Error fetching Solana price:', error);
    
    if (error instanceof Error && error.message === 'RATE_LIMIT') {
      await rateLimiter.handleError(error as CoinGeckoError);
      return getSolanaPrice(); // Retry with backoff
    }
    
    throw error;
  }
}

/**
 * Fetch trending Solana tokens from CoinGecko
 */
export async function getTrendingSolanaTokens(): Promise<TrendingToken[]> {
  // Check cache first
  const cached = trendingCache.get('trending');
  if (cached) return cached;

  try {
    await rateLimiter.throttle();

    const response = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?' +
      'vs_currency=usd&' +
      'category=solana-ecosystem&' +
      'order=market_cap_desc&' +
      'per_page=5&' +
      'page=1&' +
      'sparkline=false',
      {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      }
    );

    if (response.status === 429) {
      const error = new Error('RATE_LIMIT') as CoinGeckoError;
      error.status = 429;
      throw error;
    }

    if (!response.ok) {
      const error = new Error(`HTTP_ERROR_${response.status}`) as CoinGeckoError;
      error.status = response.status;
      throw error;
    }

    const data = await response.json();

    const tokens = data.map((coin: any) => ({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      price: coin.current_price || 0,
      price_change_24h: coin.price_change_percentage_24h || 0,
      market_cap: coin.market_cap || 0,
      volume_24h: coin.total_volume || 0
    }));

    // Cache the result
    trendingCache.set('trending', tokens, CACHE_CONFIG.trendingTTL);
    rateLimiter.reset();

    return tokens;
  } catch (error) {
    logger.error('Error fetching trending tokens:', error);
    
    if (error instanceof Error && error.message === 'RATE_LIMIT') {
      await rateLimiter.handleError(error as CoinGeckoError);
      return getTrendingSolanaTokens(); // Retry with backoff
    }
    
    throw error;
  }
} 

// Export types and configs
export type { TokenPrice, TrendingToken, CoinGeckoError };
export { RATE_LIMIT_CONFIG, CACHE_CONFIG };