import logger from "./logger";


// Types
interface BirdeyeToken {
  price: number;
  priceChange24h: number;
  volume24h: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  liquidity: number;
  v24hChangePercent: number;
  v24hUSD: number;
  mc: number;
}

interface BirdeyeResponse {
  success: boolean;
  data: {
    updateUnixTime: number;
    updateTime: string;
    tokens: BirdeyeToken[];
    total: number;
  };
}

interface BirdeyeError extends Error {
  code?: number;
  status?: number;
} 

// Constants
const BIRDEYE_API = {
  BASE_URL: 'https://public-api.birdeye.so',
  ENDPOINTS: {
    TOKEN_LIST: '/defi/tokenlist'
  },
  HEADERS: {
    'accept': 'application/json',
    'x-chain': 'solana'
  },
  RATE_LIMIT: {
    REQUESTS_PER_MINUTE: 60,
    INTERVAL_MS: 1000,
    MAX_RETRIES: 3
  },
  CACHE: {
    TTL_MS: 60000 // 1 minute
  }
} as const;

// Cache implementation
class TokenCache {
  private cache: Map<string, {
    data: BirdeyeToken[];
    timestamp: number;
  }> = new Map();

  set(key: string, data: BirdeyeToken[]): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now() + BIRDEYE_API.CACHE.TTL_MS
    });
  }

  get(key: string): BirdeyeToken[] | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.timestamp) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  clear(): void {
    this.cache.clear();
  }
}

// Rate limiter implementation
class RateLimiter {
  private requests: number[] = [];
  private retryCount: number = 0;

  async throttle(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter(time => 
      now - time < 60000
    );

    if (this.requests.length >= BIRDEYE_API.RATE_LIMIT.REQUESTS_PER_MINUTE) {
      const oldestRequest = this.requests[0];
      const waitTime = 60000 - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.requests.push(now);
  }

  async handleError(error: BirdeyeError): Promise<void> {
    this.retryCount++;

    if (this.retryCount > BIRDEYE_API.RATE_LIMIT.MAX_RETRIES) {
      this.retryCount = 0;
      throw error;
    }

    const backoffTime = BIRDEYE_API.RATE_LIMIT.INTERVAL_MS * 
      Math.pow(2, this.retryCount);
    
    await new Promise(resolve => setTimeout(resolve, backoffTime));
  }

  reset(): void {
    this.retryCount = 0;
  }
}

// Initialize cache and rate limiter
const tokenCache = new TokenCache();
const rateLimiter = new RateLimiter();

/**
 * Get Birdeye API key
 */
function getBirdeyeApiKey(): string {
  const apiKey = process.env.NEXT_PUBLIC_BIRDEYE_API_KEY;
  if (!apiKey) {
    throw new Error('BIRDEYE_API_KEY is not configured');
  }
  return apiKey;
}

/**
 * Get trending tokens from Birdeye
 */
export async function getTrendingTokens(limit: number = 10): Promise<BirdeyeToken[]> {
  try {
    // Validate input
    if (limit < 1 || limit > 100) {
      throw new Error('Invalid limit. Must be between 1 and 100');
    }

    // Check cache
    const cacheKey = `trending_${limit}`;
    const cached = tokenCache.get(cacheKey);
    if (cached) return cached;

    // Apply rate limiting
    await rateLimiter.throttle();

    // Make request
    const response = await fetch(
      `${BIRDEYE_API.BASE_URL}${BIRDEYE_API.ENDPOINTS.TOKEN_LIST}` +
      `?sort_by=v24hChangePercent&sort_type=desc&offset=0&limit=${limit}`,
      {
        headers: {
          ...BIRDEYE_API.HEADERS,
          'X-API-KEY': getBirdeyeApiKey()
        }
      }
    );

    // Handle response
    if (!response.ok) {
      const error = new Error(`HTTP error! status: ${response.status}`) as BirdeyeError;
      error.status = response.status;
      throw error;
    }

    const data = await response.json() as BirdeyeResponse;

    if (!data.success) {
      throw new Error('Birdeye API request failed');
    }

    // Process tokens
    const tokens = data.data.tokens.map(token => ({
      ...token,
      v24hChangePercent: Number(token.v24hChangePercent.toFixed(2)),
      v24hUSD: Number(token.v24hUSD.toFixed(2)),
      liquidity: Number(token.liquidity.toFixed(2)),
      mc: Number(token.mc.toFixed(2))
    }));

    // Cache results
    tokenCache.set(cacheKey, tokens);
    rateLimiter.reset();

    return tokens;
  } catch (error) {
    logger.error('Error fetching Birdeye trending tokens:', error);

    if (error instanceof Error) {
      const birdeyeError = error as BirdeyeError;
      if (birdeyeError.status === 429) {
        await rateLimiter.handleError(birdeyeError);
        return getTrendingTokens(limit); // Retry with backoff
      }
    }

    throw error;
  }
}

/**
 * Get token info from Birdeye
 */
export async function getTokenInfo(address: string): Promise<BirdeyeToken | null> {
  try {
    // Check cache
    const cacheKey = `token_${address}`;
    const cached = tokenCache.get(cacheKey);
    if (cached?.[0]) return cached[0];

    // Apply rate limiting
    await rateLimiter.throttle();

    const response = await fetch(
      `${BIRDEYE_API.BASE_URL}${BIRDEYE_API.ENDPOINTS.TOKEN_LIST}?address=${address}`,
      {
        headers: {
          ...BIRDEYE_API.HEADERS,
          'X-API-KEY': getBirdeyeApiKey()
        }
      }
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      
      const error = new Error(`HTTP error! status: ${response.status}`) as BirdeyeError;
      error.status = response.status;
      throw error;
    }

    const data = await response.json() as BirdeyeResponse;

    if (!data.success || !data.data.tokens.length) {
      return null;
    }

    const token = data.data.tokens[0];
    const processedToken = {
      ...token,
      v24hChangePercent: Number(token.v24hChangePercent.toFixed(2)),
      v24hUSD: Number(token.v24hUSD.toFixed(2)),
      liquidity: Number(token.liquidity.toFixed(2)),
      mc: Number(token.mc.toFixed(2))
    };

    // Cache result
    tokenCache.set(cacheKey, [processedToken]);
    rateLimiter.reset();

    return processedToken;
  } catch (error) {
    logger.error('Error fetching Birdeye token info:', error);
    
    if (error instanceof Error) {
      const birdeyeError = error as BirdeyeError;
      if (birdeyeError.status === 429) {
        await rateLimiter.handleError(birdeyeError);
        return getTokenInfo(address); // Retry with backoff
      }
    }

    throw error;
  }
}

// Export types
export type { BirdeyeToken, BirdeyeResponse, BirdeyeError };