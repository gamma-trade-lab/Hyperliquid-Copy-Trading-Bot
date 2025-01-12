import { TokenProvider } from '../../../providers/token';
import { RedisService } from '../../market/data/RedisCache';
import { elizaLogger } from "@ai16z/eliza";
import { Connection, PublicKey, PublicKeyInitData } from '@solana/web3.js';
import { WalletProvider } from '../../../providers/wallet';
import { ICacheManager } from '@elizaos/core';

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
  connection?: string;
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
  rpcConnection?: {
    url?: string;
    walletPublicKey?: string;
  };
}

export interface TokenMovement {
  id: string;          // Added
  symbol: string;
  address: string;
  price: number;       // Added
  priceChange24h: number;
  volume24h: number;
  currentPrice: number;
  marketCap: number;   // Added
}

export class JupiterPriceV2Service {
  private tokenProvider: TokenProvider;
  private cache: RedisService;
  private readonly SOLANA_PUBLIC_KEY: PublicKey = new PublicKey(
    process.env.SOLANA_PUBLIC_KEY || 'C7DjuqwXZ2kZ2D9RMDXv5HjiR7PVkLFJgnX7PKraPDaM'
  );
  private static readonly CACHE_TTL = 300; // 5 minutes
  private readonly config: JupiterPriceServiceConfig;

  constructor(config: JupiterPriceServiceConfig) {
    this.config = config;
    
    // Initialize Redis cache
    this.cache = new RedisService({
      host: config.redis?.host || 'localhost',
      port: config.redis?.port || 6379,
      password: config.redis?.password,
      keyPrefix: config.redis?.keyPrefix || 'jupiter-price:'
    });

    // Initialize providers with validation
    const connection = new Connection(
      config.rpcConnection?.url || 'https://api.mainnet-beta.solana.com'
    );
    
    let walletPublicKey: PublicKey;
    try {
      walletPublicKey = config.rpcConnection?.walletPublicKey ? 
        new PublicKey(config.rpcConnection.walletPublicKey) :
        new PublicKey(this.SOLANA_PUBLIC_KEY);
    } catch (error) {
      elizaLogger.warn('Invalid wallet public key provided, using default');
      walletPublicKey = new PublicKey(this.SOLANA_PUBLIC_KEY);
    }
    
    const walletProvider = new WalletProvider(connection, walletPublicKey);
    
    this.tokenProvider = new TokenProvider(
      '',  // Will be set per request
      walletProvider,
      this.cache as ICacheManager
    );
  }

  public async getMarketMetrics(symbol: string): Promise<MarketMetrics> {
    try {
      const cacheKey = `metrics:${symbol}`;
      const cached = await this.cache.get(cacheKey);
      
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }

      // Get token data
      const tokenData = await this.tokenProvider.getProcessedTokenData();
      const tradeData = tokenData.tradeData;
      const dexData = tokenData.dexScreenerData;

      const marketMetrics: MarketMetrics = {
        price: Number(tradeData.price),
        volume24h: Number(tradeData.volume_24h_usd),
        priceChange24h: Number(tradeData.price_change_24h_percent),
        marketCap: dexData.pairs[0]?.marketCap || 0,
        confidenceLevel: this.calculateConfidenceLevel(tradeData, dexData)
      };

      await this.cache.set(
        cacheKey, 
        JSON.stringify(marketMetrics), 
        { expires: JupiterPriceV2Service.CACHE_TTL }
      );

      return marketMetrics;

    } catch (error) {
      elizaLogger.error(`Failed to fetch market metrics for ${symbol}:`, error);
      throw error;
    }
  }

  private calculateConfidenceLevel(tradeData: any, dexData: any): 'high' | 'medium' | 'low' {
    const volume24h = Number(tradeData.volume_24h_usd);
    const liquidity = dexData.pairs[0]?.liquidity?.usd || 0;

    if (volume24h > 100000 && liquidity > 50000) return 'high';
    if (volume24h > 10000 && liquidity > 10000) return 'medium';
    return 'low';
  }

   
  // Continuing the JupiterPriceV2Service class...

public async getTokenPrice(symbol: string): Promise<TokenPrice | null> {
  try {
    const cacheKey = `price:${symbol}`;
    const cached = await this.cache.get(cacheKey);
    
    if (typeof cached === 'string') {
      return JSON.parse(cached);
    }

    // Get token data from TokenProvider
    const tokenData = await this.tokenProvider.getProcessedTokenData();
    const tradeData = tokenData.tradeData;

    const tokenPrice: TokenPrice = {
      id: tokenData.tokenCodex.id,
      type: 'token',
      price: tradeData.price.toString(),
      extraInfo: {
        lastSwappedPrice: {
          lastJupiterSellAt: tradeData.last_trade_unix_time,
          lastJupiterSellPrice: tradeData.history_24h_price.toString(),
          lastJupiterBuyAt: tradeData.last_trade_unix_time,
          lastJupiterBuyPrice: tradeData.price.toString()
        },
        quotedPrice: {
          buyPrice: tradeData.price.toString(),
          buyAt: Date.now(),
          sellPrice: tradeData.history_24h_price.toString(),
          sellAt: tradeData.last_trade_unix_time
        },
        confidenceLevel: this.calculateConfidenceLevel(tradeData, tokenData.dexScreenerData),
        depth: {
          buyPriceImpactRatio: {
            depth: this.calculateDepthImpact(tokenData, 'buy'),
            timestamp: Date.now()
          },
          sellPriceImpactRatio: {
            depth: this.calculateDepthImpact(tokenData, 'sell'),
            timestamp: Date.now()
          }
        }
      }
    };

    await this.cache.set(
      cacheKey,
      JSON.stringify(tokenPrice),
      { expires: JupiterPriceV2Service.CACHE_TTL }
    );

    return tokenPrice;

  } catch (error) {
    elizaLogger.error(`Failed to fetch token price for ${symbol}:`, error);
    throw error;
  }
}

public async getMarketData(symbol: string): Promise<{
  price: number;
  volume24h: number;
  priceChange24h: number;
  marketCap: number;
}> {
  try {
    const cacheKey = `marketData:${symbol}`;
    const cached = await this.cache.get(cacheKey);
    
    if (typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const tokenData = await this.tokenProvider.getProcessedTokenData();
    const tradeData = tokenData.tradeData;
    const dexData = tokenData.dexScreenerData;

    const marketData = {
      price: Number(tradeData.price),
      volume24h: Number(tradeData.volume_24h_usd),
      priceChange24h: Number(tradeData.price_change_24h_percent),
      marketCap: dexData.pairs[0]?.marketCap || 0
    };

    await this.cache.set(
      cacheKey,
      JSON.stringify(marketData),
      { expires: JupiterPriceV2Service.CACHE_TTL }
    );

    return marketData;

  } catch (error) {
    elizaLogger.error(`Failed to fetch market data for ${symbol}:`, error);
    throw error;
  }
}

public async getTokenInfo(symbol: string): Promise<TokenInfo | null> {
  try {
    const cacheKey = `tokenInfo:${symbol}`;
    const cached = await this.cache.get(cacheKey);
    
    if (typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const tokenData = await this.tokenProvider.getProcessedTokenData();
    const tokenCodex = tokenData.tokenCodex;

    if (!tokenCodex || !tokenCodex.address) {
      return null;
    }

    const tokenInfo: TokenInfo = {
      id: tokenCodex.id,
      symbol: tokenCodex.symbol,
      name: tokenCodex.name,
      price: Number(tokenData.tradeData.price),
      volume24h: Number(tokenData.tradeData.volume_24h_usd),
      marketCap: tokenData.dexScreenerData.pairs[0]?.marketCap || 0,
      address: tokenCodex.address,
      verified: tokenCodex.blueCheckmark
    };

    await this.cache.set(
      cacheKey,
      JSON.stringify(tokenInfo),
      { expires: JupiterPriceV2Service.CACHE_TTL }
    );

    return tokenInfo;

  } catch (error) {
    elizaLogger.error(`Failed to fetch token info for ${symbol}:`, error);
    throw error;
  }
}

private calculateDepthImpact(tokenData: any, type: 'buy' | 'sell'): Record<string, number> {
  const depths = {
    '10': 0.01,   // 1% impact for 10 SOL
    '100': 0.05,  // 5% impact for 100 SOL
    '1000': 0.1   // 10% impact for 1000 SOL
  };

  const liquidity = tokenData.dexScreenerData.pairs[0]?.liquidity?.usd || 0;
  const marketCap = tokenData.dexScreenerData.pairs[0]?.marketCap || 0;

  // Adjust impact based on liquidity and market cap
  const liquidityFactor = liquidity > 100000 ? 0.5 : 1;
  const marketCapFactor = marketCap > 1000000 ? 0.5 : 1;

  const impactMultiplier = liquidityFactor * marketCapFactor;

  return Object.entries(depths).reduce((acc, [depth, impact]) => {
    acc[depth] = impact * impactMultiplier;
    return acc;
  }, {} as Record<string, number>);
}

public async initializeCache(): Promise<void> {
  try {
    await this.cache.connect();
    elizaLogger.info('Jupiter price cache initialized successfully');
  } catch (error) {
    elizaLogger.error('Failed to initialize Jupiter price cache:', error);
    throw error;
  }
}

public async clearCache(): Promise<void> {
  try {
    await this.cache.flushAll();
    elizaLogger.info('Jupiter price cache cleared successfully');
  } catch (error) {
    elizaLogger.error('Failed to clear Jupiter price cache:', error);
    throw error;
  }
}

public setTokenProvider(tokenAddress: string): void {
  const connection = new Connection(
    this.config.rpcConnection?.url || 'https://api.mainnet-beta.solana.com'
  );
  
  const walletProvider = new WalletProvider(
    connection,
    new PublicKey(this.config.rpcConnection?.walletPublicKey || '')
  );
  
  this.tokenProvider = new TokenProvider(
    tokenAddress,
    walletProvider,
    this.cache as ICacheManager
  );
}

public async getTopMovers(limit: number = 10): Promise<TokenMovement[]> {
  try {
    const cacheKey = `topMovers:${limit}`;
    const cached = await this.cache.get<TokenMovement[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const tokenData = await this.tokenProvider.getProcessedTokenData();
    const tradeData = tokenData.tradeData;
    const dexData = tokenData.dexScreenerData;
    
    const movements: TokenMovement[] = [{
      id: tokenData.tokenCodex.id,
      symbol: tokenData.tokenCodex.symbol,
      address: tokenData.tokenCodex.address,
      price: Number(tradeData.price),
      priceChange24h: Number(tradeData.price_change_24h_percent),
      volume24h: Number(tradeData.volume_24h_usd),
      currentPrice: Number(tradeData.price),
      marketCap: dexData.pairs[0]?.marketCap || 0
    }];

    const topMovers = movements
      .sort((a, b) => Math.abs(b.priceChange24h) - Math.abs(a.priceChange24h))
      .slice(0, limit);

    await this.cache.set(cacheKey, topMovers, { 
      expires: Date.now() + (5 * 60 * 1000)
    });

    return topMovers;

  } catch (error) {
    elizaLogger.error('Failed to fetch top movers:', error);
    throw error;
  }
}

public async getHighestVolumeTokens(limit: number = 10): Promise<TokenMovement[]> {
  try {
    const cacheKey = `highestVolume:${limit}`;
    const cached = await this.cache.get<TokenMovement[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const tokenData = await this.tokenProvider.getProcessedTokenData();
    const tradeData = tokenData.tradeData;
    const dexData = tokenData.dexScreenerData;
    
    const movements: TokenMovement[] = [{
      id: tokenData.tokenCodex.id,
      symbol: tokenData.tokenCodex.symbol,
      address: tokenData.tokenCodex.address,
      price: Number(tradeData.price),
      priceChange24h: Number(tradeData.price_change_24h_percent),
      volume24h: Number(tradeData.volume_24h_usd),
      currentPrice: Number(tradeData.price),
      marketCap: dexData.pairs[0]?.marketCap || 0
    }];

    const highestVolume = movements
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, limit);

    await this.cache.set(cacheKey, highestVolume, {
      expires: Date.now() + (5 * 60 * 1000)
    });

    return highestVolume;

  } catch (error) {
    elizaLogger.error('Failed to fetch highest volume tokens:', error);
    throw error;
  }
}
}

export default JupiterPriceV2Service;
