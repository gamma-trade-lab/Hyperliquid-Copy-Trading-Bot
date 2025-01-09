// src/services/blockchain/heliusIntegration.ts
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { elizaLogger } from "@ai16z/eliza";
import redisClient from '../../config/inMemoryDB.js';
export interface HeliusRequestOptions {
  commitment?: 'processed' | 'confirmed' | 'finalized';
  encoding?: 'base58' | 'base64' | 'jsonParsed';
  maxSupportedTransactionVersion?: number;
}

export class HeliusService {
  [x: string]: any;
  getMintAccountInfo(tokenAddress: string): Promise<MintInfo | null> {
    // Implementation to fetch mint account info
    // Ensure it returns an object of type MintInfo or null
    throw new Error('Method not implemented.');
  }
  getHoldersClassification(tokenAddress: string): Promise<HolderInfo | null> {
    // Implementation to fetch holders classification
    // Ensure it returns an object of type HolderInfo or null
    throw new Error('Method not implemented.');
  }
  private apiKey: string;
  private baseUrl: string;
  private connection: Connection;
  private static readonly CACHE_TTL = 60; // 1 minute
  private static readonly MAX_RETRIES = 3;
  private static readonly RATE_LIMIT = {
    requests: 0,
    lastReset: Date.now(),
    limit: 600, // 600 requests per minute
    interval: 60000, // 1 minute
  };

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = `https://mainnet.helius-rpc.com/?api-key=${this.apiKey}`;
    this.connection = new Connection(this.baseUrl);
  }

  private async checkHealth(): Promise<{ status: string; distance?: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }
      const status = await response.text();
      
      if (status === 'ok') {
        return { status: 'ok' };
      }
      
      const behindMatch = status.match(/behind \{ distance: (\d+) \}/);
      if (behindMatch) {
        return { status: 'behind', distance: parseInt(behindMatch[1]) };
      }
      
      return { status: 'unknown' };
    } catch (error) {
      elizaLogger.error('Health check failed:', error);
      throw error;
    }
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const { requests, lastReset, limit, interval } = HeliusService.RATE_LIMIT;

    if (now - lastReset >= interval) {
      HeliusService.RATE_LIMIT.requests = 0;
      HeliusService.RATE_LIMIT.lastReset = now;
      return;
    }

    if (requests >= limit) {
      const waitTime = interval - (now - lastReset);
      elizaLogger.warn(`Rate limit reached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      HeliusService.RATE_LIMIT.requests = 0;
      HeliusService.RATE_LIMIT.lastReset = Date.now();
    }

    HeliusService.RATE_LIMIT.requests++;
  }

  private async makeRequest<T>(
    method: string,
    params: any[],
    options: HeliusRequestOptions = {}
  ): Promise<T> {
    const cacheKey = `helius:${method}:${JSON.stringify(params)}:${JSON.stringify(options)}`;
    
    // Try cache first
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    await this.checkRateLimit();

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < HeliusService.MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: `${Date.now()}-${Math.random()}`,
            method,
            params: [...params, { commitment: options.commitment || 'finalized', ...options }],
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
          throw new Error(`Helius API error: ${data.error.message || JSON.stringify(data.error)}`);
        }

        // Cache successful response
        await redisClient.set(cacheKey, JSON.stringify(data.result), 'EX', HeliusService.CACHE_TTL);
        
        return data.result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        elizaLogger.warn(`Attempt ${attempt + 1} failed:`, lastError.message);
        
        if (attempt < HeliusService.MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('Request failed after all retries');
  }

  async getBalance(address: string): Promise<number> {
    const result = await this.makeRequest<{ value: number }>('getBalance', [address]);
    return result.value / LAMPORTS_PER_SOL;
  }

  async getAccountInfo(address: string, options: HeliusRequestOptions = {}): Promise<any> {
    return this.makeRequest('getAccountInfo', [address], options);
  }

  async getTransactions(
    address: string,
    options: {
      limit?: number;
      before?: string;
      until?: string;
    } = {}
  ): Promise<HeliusTransaction[]> {
    const transactions = await this.makeRequest<HeliusTransaction[]>(
      'getSignaturesForAddress',
      [
        address,
        {
          limit: options.limit || 100,
          before: options.before,
          until: options.until,
        },
      ]
    );

    // Validate response
    if (!Array.isArray(transactions)) {
      throw new Error('Invalid response format from Helius API');
    }

    return transactions;
  }

  async getAssetsByOwner(ownerAddress: string): Promise<any> {
    return this.makeRequest('getAssetsByOwner', [ownerAddress, { page: 1, limit: 100 }]);
  }

  async getParsedTransaction(signature: string): Promise<any> {
    return this.makeRequest(
      'getTransaction',
      [signature],
      {
        encoding: 'jsonParsed',
        maxSupportedTransactionVersion: 0
      }
    );
  }

  async isHealthy(): Promise<boolean> {
    const health = await this.checkHealth();
    return health.status === 'ok' || (health.status === 'behind' && (health.distance || 0) < 100);
  }
}

// In the getTransactions method

export interface Holder {
  owner: string;
  balance: number;
  classification?: string;
}

export interface MintInfo {
  mint: string;
  decimals: number;
  supply: bigint;
  isInitialized: boolean;
  freezeAuthority: string;
  mintAuthority: string;
}

export interface FungibleToken {
  interface: 'FungibleToken' | 'FungibleAsset';
  id: string;
  content: {
    $schema?: string;
    files: Array<{
      uri: string;
      cdn_uri: string;
      mime: string;
    }>;
    metadata?: {
      description: string;
      name: string;
      symbol: string;
      token_standard: string;
    };
    links?: {
      image?: string;
    };
  };
  token_info: {
    symbol: string;
    balance: number;
    supply: number;
    decimals: number;
    price_info?: {
      price_per_token?: number;
      total_price?: number;
    };
  };
}

// Add at the bottom with other interfaces
export interface HeliusError {
  code: number;
  message: string;
  data?: any;
}

// Add with other interfaces
export interface HeliusTransaction {
  signature: string;
  slot: number;
  err: any;
  memo: string | null;
  blockTime: number | null;
  confirmationStatus: string;
}

export interface MintInfo {
  supply: bigint;
  decimals: number;
}

export interface HolderInfo {
  totalHolders: number;
  topHolders: Array<{ owner: string; balance: number }>;
  totalSupply: number;
}
