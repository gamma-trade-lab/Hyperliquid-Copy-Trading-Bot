import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { z } from 'zod';

// Validation schemas
const mintInfoSchema = z.object({
  mint: z.string(),
  decimals: z.number(),
  supply: z.bigint(),
  isInitialized: z.boolean(),
  freezeAuthority: z.string().nullable(),
  mintAuthority: z.string().nullable()
});

const holderSchema = z.object({
  owner: z.string(),
  balance: z.number(),
  classification: z.string().optional()
});

export interface MarketMetrics {
  supply: {
    total: number;
    circulating: number;
    locked: number;
    burned: number;
  };
  holders: {
    total: number;
    active: number;
    distribution: {
      gini: number;
      top10: number;
      top50: number;
      top100: number;
    };
  };
  volume: {
    total24h: number;
    buy24h: number;
    sell24h: number;
    transactions24h: number;
  };
  liquidity: {
    total: number;
    mainPools: {
      poolAddress: string;
      liquidity: number;
      volume24h: number;
      fee: number;
    }[];
  };
}

export class MarketAnalysisService {
  private readonly heliusUrl: string;
  private readonly rateLimiter = {
    lastRequest: 0,
    minInterval: 100, // ms between requests
    
    async throttle() {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequest;
      if (timeSinceLastRequest < this.minInterval) {
        await new Promise(resolve => setTimeout(resolve, this.minInterval - timeSinceLastRequest));
      }
      this.lastRequest = Date.now();
    }
  };

  constructor() {
    const apiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
    if (!apiKey) {
      throw new Error('HELIUS_API_KEY is not configured');
    }
    this.heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  }

  private async fetchHelius(method: string, params: any) {
    await this.rateLimiter.throttle();

    try {
      const response = await fetch(this.heliusUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'market-analysis',
          method,
          params
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(`Helius API error: ${data.error.message}`);
      }

      return data.result;
    } catch (error) {
      console.error('Helius API error:', error);
      throw error;
    }
  }

  async getMintInfo(mint: string) {
    const result = await this.fetchHelius('getAccountInfo', [
      mint,
      { encoding: 'jsonParsed' }
    ]);

    if (!result?.value?.data?.parsed || result.value.data.parsed.type !== 'mint') {
      throw new Error(`Invalid mint account: ${mint}`);
    }

    const info = result.value.data.parsed.info;
    return mintInfoSchema.parse({
      mint,
      decimals: info.decimals,
      supply: BigInt(info.supply),
      isInitialized: info.isInitialized,
      freezeAuthority: info.freezeAuthority,
      mintAuthority: info.mintAuthority
    });
  }

  async getTokenHolders(mint: string) {
    const holders = new Map<string, z.infer<typeof holderSchema>>();
    let page = 1;

    while (true) {
      const data = await this.fetchHelius('getTokenAccounts', {
        mint,
        page,
        limit: 1000
      });

      if (!data?.token_accounts?.length) break;

      for (const account of data.token_accounts) {
        const owner = account.owner;
        const balanceRaw = BigInt(account.amount || '0');
        const mintInfo = await this.getMintInfo(mint);
        const balance = Number(balanceRaw) / Math.pow(10, mintInfo.decimals);

        if (holders.has(owner)) {
          const existing = holders.get(owner)!;
          existing.balance += balance;
        } else {
          holders.set(owner, holderSchema.parse({
            owner,
            balance,
            classification: undefined
          }));
        }
      }

      page++;
    }

    return Array.from(holders.values());
  }

  async classifyHolders(holders: z.infer<typeof holderSchema>[], chunkSize = 20) {
    const chunks = this.chunkArray(holders.map(h => h.owner), chunkSize);
    
    for (const chunk of chunks) {
      const accounts = await this.fetchHelius('getMultipleAccounts', [
        chunk,
        { encoding: 'jsonParsed' }
      ]);

      if (!accounts?.value) continue;

      for (let i = 0; i < chunk.length; i++) {
        const address = chunk[i];
        const accountInfo = accounts.value[i];
        const holder = holders.find(h => h.owner === address);
        if (!holder) continue;

        holder.classification = this.classifyAccount(accountInfo);
      }
    }

    return holders;
  }

  async getMarketMetrics(mint: string): Promise<MarketMetrics> {
    const [mintInfo, holders] = await Promise.all([
      this.getMintInfo(mint),
      this.getTokenHolders(mint)
    ]);

    const classifiedHolders = await this.classifyHolders(holders);
    const distribution = this.calculateDistribution(classifiedHolders);
    
    // Get volume data
    const volume = await this.getVolumeMetrics(mint);
    
    // Get liquidity data
    const liquidity = await this.getLiquidityMetrics(mint);

    return {
      supply: {
        total: Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals),
        circulating: this.calculateCirculatingSupply(classifiedHolders, mintInfo),
        locked: this.calculateLockedSupply(classifiedHolders, mintInfo),
        burned: this.calculateBurnedSupply(classifiedHolders, mintInfo)
      },
      holders: {
        total: holders.length,
        active: this.countActiveHolders(classifiedHolders),
        distribution
      },
      volume,
      liquidity
    };
  }

  private classifyAccount(accountInfo: any): string {
    if (!accountInfo) return "Unknown";
    
    // Add classification logic based on account type
    if (accountInfo.executable) return "Program";
    
    const owner = accountInfo.owner;
    switch (owner) {
      case "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA":
        return "Token Account";
      case "11111111111111111111111111111111":
        return "System Account";
      case "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL":
        return "Associated Token Account";
      default:
        return "Other";
    }
  }

  private calculateDistribution(holders: z.infer<typeof holderSchema>[]) {
    const sortedBalances = holders
      .map(h => h.balance)
      .sort((a, b) => b - a);

    const total = sortedBalances.reduce((sum, bal) => sum + bal, 0);
    const getTopNPercentage = (n: number) => {
      const topN = sortedBalances.slice(0, n);
      return (topN.reduce((sum, bal) => sum + bal, 0) / total) * 100;
    };

    return {
      gini: this.calculateGiniCoefficient(sortedBalances),
      top10: getTopNPercentage(10),
      top50: getTopNPercentage(50),
      top100: getTopNPercentage(100)
    };
  }

  private calculateGiniCoefficient(sortedBalances: number[]): number {
    if (sortedBalances.length === 0) return 0;
    
    const n = sortedBalances.length;
    const mean = sortedBalances.reduce((sum, val) => sum + val, 0) / n;
    
    let sumOfAbsoluteDifferences = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        sumOfAbsoluteDifferences += Math.abs(sortedBalances[i] - sortedBalances[j]);
      }
    }
    
    return sumOfAbsoluteDifferences / (2 * n * n * mean);
  }

  private async getVolumeMetrics(mint: string) {
    // Implement volume metrics calculation using Helius API
    return {
      total24h: 0,
      buy24h: 0,
      sell24h: 0,
      transactions24h: 0
    };
  }

  private async getLiquidityMetrics(mint: string) {
    // Implement liquidity metrics calculation
    return {
      total: 0,
      mainPools: []
    };
  }

  private calculateCirculatingSupply(
    holders: z.infer<typeof holderSchema>[],
    mintInfo: z.infer<typeof mintInfoSchema>
  ): number {
    return holders.reduce((sum, holder) => {
      // Exclude locked/burned tokens
      if (this.isLockedOrBurnedAddress(holder.owner)) return sum;
      return sum + holder.balance;
    }, 0);
  }

  private calculateLockedSupply(
    holders: z.infer<typeof holderSchema>[],
    mintInfo: z.infer<typeof mintInfoSchema>
  ): number {
    return holders.reduce((sum, holder) => {
      if (this.isLockedAddress(holder.owner)) return sum + holder.balance;
      return sum;
    }, 0);
  }

  private calculateBurnedSupply(
    holders: z.infer<typeof holderSchema>[],
    mintInfo: z.infer<typeof mintInfoSchema>
  ): number {
    return holders.reduce((sum, holder) => {
      if (this.isBurnedAddress(holder.owner)) return sum + holder.balance;
      return sum;
    }, 0);
  }

  private countActiveHolders(holders: z.infer<typeof holderSchema>[]): number {
    // Consider a holder active if they have more than dust balance
    const DUST_THRESHOLD = 0.001;
    return holders.filter(h => h.balance > DUST_THRESHOLD).length;
  }

  private isLockedOrBurnedAddress(address: string): boolean {
    return this.isLockedAddress(address) || this.isBurnedAddress(address);
  }

  private isLockedAddress(address: string): boolean {
    // Add known locked addresses
    const lockedAddresses: string[] = [
      // Add team vesting, treasury, etc.
    ];
    return lockedAddresses.includes(address);
  }

  private isBurnedAddress(address: string): boolean {
    // Add known burn addresses
    const burnAddresses = [
      '1111111111111111111111111111111111111111',
      'deaddeaddeaddeaddeaddeaddeaddeaddeaddead'
    ];
    return burnAddresses.includes(address);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Export singleton instance
export const marketAnalysis = new MarketAnalysisService();    