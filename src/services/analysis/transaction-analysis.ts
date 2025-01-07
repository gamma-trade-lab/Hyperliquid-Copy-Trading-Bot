import { z } from 'zod';

// Validation schemas
const tokenTransferSchema = z.object({
  amount: z.number(),
  symbol: z.string(),
  tokenAddress: z.string().optional()
});

const transactionDetailSchema = z.object({
  type: z.string(),
  timestamp: z.string(),
  status: z.string(),
  amount: z.number().optional(),
  sender: z.string().optional(),
  receiver: z.string().optional(),
  fee: z.number().optional(),
  tokenTransfer: tokenTransferSchema.optional()
});

export interface TransactionMetrics {
  volume: {
    total: number;
    inflow: number;
    outflow: number;
  };
  activity: {
    totalTx: number;
    uniqueAddresses: number;
    successRate: number;
  };
  fees: {
    total: number;
    average: number;
    max: number;
  };
  timing: {
    averageConfirmation: number;
    failureRate: number;
    peakHours: number[];
  };
}

export interface TransactionPattern {
  type: 'accumulation' | 'distribution' | 'neutral';
  confidence: number;
  details: {
    largeTransactions: number;
    uniqueBuyers: number;
    uniqueSellers: number;
    averageSize: number;
    timeFrame: string;
  };
}

export class TransactionAnalysisService {
  private readonly heliusUrl: string;
  private readonly rateLimiter = {
    lastRequest: 0,
    minInterval: 100,
    
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
          id: 'tx-analysis',
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

  async getTransactionDetails(signature: string) {
    const result = await this.fetchHelius('getTransaction', [
      signature,
      { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }
    ]);

    if (!result) {
      throw new Error('Transaction not found');
    }

    // Parse token transfers
    let tokenTransfer;
    if (result.meta?.postTokenBalances?.length > 0 || result.meta?.preTokenBalances?.length > 0) {
      const postBalances = result.meta.postTokenBalances || [];
      const preBalances = result.meta.preTokenBalances || [];
      
      for (let i = 0; i < Math.max(postBalances.length, preBalances.length); i++) {
        const post = postBalances[i];
        const pre = preBalances.find(p => p.accountIndex === post?.accountIndex);
        
        if (post?.uiTokenAmount && pre?.uiTokenAmount) {
          const amount = Math.abs(
            (post.uiTokenAmount.uiAmount || 0) - 
            (pre.uiTokenAmount.uiAmount || 0)
          );
          
          if (amount > 0) {
            tokenTransfer = tokenTransferSchema.parse({
              amount,
              symbol: post.uiTokenAmount.uiTokenSymbol || '',
              tokenAddress: result.transaction?.message?.accountKeys?.[post.accountIndex]
            });
            break;
          }
        }
      }
    }

    return transactionDetailSchema.parse({
      type: result.meta?.type || 'Unknown',
      timestamp: new Date(result.blockTime * 1000).toLocaleString(),
      status: result.meta?.err ? 'Failed' : 'Success',
      amount: result.meta?.postBalances?.[0] 
        ? (result.meta.postBalances[0] - result.meta.preBalances[0]) / 1e9 
        : undefined,
      fee: result.meta?.fee ? result.meta.fee / 1e9 : undefined,
      sender: result.transaction?.message?.accountKeys?.[0],
      receiver: result.transaction?.message?.accountKeys?.[1],
      tokenTransfer
    });
  }

  async getTransactionMetrics(
    mintAddress: string,
    timeframe: '1h' | '24h' | '7d' = '24h'
  ): Promise<TransactionMetrics> {
    const transactions = await this.getTokenTransactions(mintAddress, timeframe);
    
    // Calculate volume metrics
    const volume = this.calculateVolumeMetrics(transactions);
    
    // Calculate activity metrics
    const activity = this.calculateActivityMetrics(transactions);
    
    // Calculate fee metrics
    const fees = this.calculateFeeMetrics(transactions);
    
    // Calculate timing metrics
    const timing = this.calculateTimingMetrics(transactions);

    return {
      volume,
      activity,
      fees,
      timing
    };
  }

  async analyzeTransactionPatterns(
    mintAddress: string,
    timeframe: '1h' | '24h' | '7d' = '24h'
  ): Promise<TransactionPattern> {
    const transactions = await this.getTokenTransactions(mintAddress, timeframe);
    
    // Analyze transaction sizes
    const sizes = transactions.map(tx => tx.amount || 0);
    const averageSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    
    // Count unique addresses
    const uniqueAddresses = new Set();
    transactions.forEach(tx => {
      if (tx.sender) uniqueAddresses.add(tx.sender);
      if (tx.receiver) uniqueAddresses.add(tx.receiver);
    });
    
    // Analyze large transactions
    const largeThreshold = averageSize * 2;
    const largeTransactions = sizes.filter(s => s > largeThreshold).length;
    
    // Calculate buyer/seller ratio
    const buyers = new Set();
    const sellers = new Set();
    transactions.forEach(tx => {
      if (tx.amount && tx.amount > 0) {
        buyers.add(tx.receiver);
        sellers.add(tx.sender);
      }
    });

    // Determine pattern type
    let type: 'accumulation' | 'distribution' | 'neutral';
    let confidence: number;

    if (buyers.size > sellers.size * 1.5) {
      type = 'accumulation';
      confidence = Math.min((buyers.size / sellers.size - 1) * 0.5, 1);
    } else if (sellers.size > buyers.size * 1.5) {
      type = 'distribution';
      confidence = Math.min((sellers.size / buyers.size - 1) * 0.5, 1);
    } else {
      type = 'neutral';
      confidence = 1 - Math.abs(buyers.size - sellers.size) / Math.max(buyers.size, sellers.size);
    }

    return {
      type,
      confidence,
      details: {
        largeTransactions,
        uniqueBuyers: buyers.size,
        uniqueSellers: sellers.size,
        averageSize,
        timeFrame: timeframe
      }
    };
  }

  private async getTokenTransactions(
    mintAddress: string,
    timeframe: '1h' | '24h' | '7d'
  ) {
    // Convert timeframe to unix timestamp
    const now = Math.floor(Date.now() / 1000);
    const timeframeSeconds = {
      '1h': 3600,
      '24h': 86400,
      '7d': 604800
    }[timeframe];
    
    const startTime = now - timeframeSeconds;
    
    // Fetch transactions from Helius
    // Note: This is a placeholder. Implement actual transaction fetching logic
    return [];
  }

  private calculateVolumeMetrics(transactions: z.infer<typeof transactionDetailSchema>[]) {
    let total = 0;
    let inflow = 0;
    let outflow = 0;

    transactions.forEach(tx => {
      if (!tx.amount) return;
      
      total += Math.abs(tx.amount);
      if (tx.amount > 0) {
        inflow += tx.amount;
      } else {
        outflow += Math.abs(tx.amount);
      }
    });

    return { total, inflow, outflow };
  }

  private calculateActivityMetrics(transactions: z.infer<typeof transactionDetailSchema>[]) {
    const uniqueAddresses = new Set();
    let successCount = 0;

    transactions.forEach(tx => {
      if (tx.sender) uniqueAddresses.add(tx.sender);
      if (tx.receiver) uniqueAddresses.add(tx.receiver);
      if (tx.status === 'Success') successCount++;
    });

    return {
      totalTx: transactions.length,
      uniqueAddresses: uniqueAddresses.size,
      successRate: transactions.length > 0 ? successCount / transactions.length : 1
    };
  }

  private calculateFeeMetrics(transactions: z.infer<typeof transactionDetailSchema>[]) {
    const fees = transactions
      .map(tx => tx.fee || 0)
      .filter(fee => fee > 0);

    const total = fees.reduce((a, b) => a + b, 0);
    const average = fees.length > 0 ? total / fees.length : 0;
    const max = Math.max(...fees, 0);

    return { total, average, max };
  }

  private calculateTimingMetrics(transactions: z.infer<typeof transactionDetailSchema>[]) {
    // This is a placeholder. Implement actual timing metrics calculation
    return {
      averageConfirmation: 0,
      failureRate: 0,
      peakHours: []
    };
  }
}

// Export singleton instance
export const transactionAnalysis = new TransactionAnalysisService(); 