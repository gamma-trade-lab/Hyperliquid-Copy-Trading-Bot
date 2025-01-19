import { Connection, PublicKey, ParsedTransactionWithMeta, ParsedMessage, ParsedMessageAccount } from '@solana/web3.js';
import { elizaLogger } from "@ai16z/eliza";
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

// Constants for transaction analysis
const MAX_TRANSACTIONS = 1000;
const MIN_TRANSACTIONS = 1;
const DEFAULT_TRANSACTIONS = 10;

interface TransactionDetails {
  signature: string;
  timestamp: number;
  success: boolean;
  amount?: number;
  tokenTransfers?: {
    token: string;
    amount: number;
    decimals: number;
  }[];
  programIds: string[];
  fee: number;
}

interface TransactionMetrics {
  totalVolume: number;
  successRate: number;
  averageAmount: number;
  uniqueTokens: string[];
  programInteractions: Map<string, number>;
  timeSpan?: {
    first: number;
    last: number;
  };
}

export class TransactionProcessor {
  private connection: Connection;
  private cache: Map<string, TransactionDetails[]>;

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.cache = new Map();
  }

  /**
   * Fetch and process transactions for a wallet
   */
  async getTransactions(
    walletAddress: string,
    limit: number = DEFAULT_TRANSACTIONS
  ): Promise<TransactionDetails[]> {
    try {
      // Validate inputs
      if (!this.isValidPublicKey(walletAddress)) {
        throw new Error('Invalid wallet address');
      }

      limit = Math.min(Math.max(limit, MIN_TRANSACTIONS), MAX_TRANSACTIONS);

      // Check cache
      const cacheKey = `${walletAddress}-${limit}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)!;
      }

      const pubKey = new PublicKey(walletAddress);
      const signatures = await this.connection.getSignaturesForAddress(pubKey, {
        limit
      });

      const transactions: TransactionDetails[] = [];

      for (const sig of signatures) {
        try {
          const tx = await this.connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0
          });

          if (!tx) continue;

          const details = await this.processTransaction(tx, pubKey);
          if (details) {
            transactions.push(details);
          }
        } catch (error) {
          elizaLogger.error(`Error processing transaction ${sig.signature}:`, error);
          continue;
        }
      }

      // Cache results
      this.cache.set(cacheKey, transactions);

      return transactions;
    } catch (error) {
      elizaLogger.error('Error fetching transactions:', error);
      throw new Error('Failed to fetch transactions');
    }
  }

  /**
   * Calculate metrics from transactions
   */
  async getTransactionMetrics(
    walletAddress: string,
    limit?: number
  ): Promise<TransactionMetrics> {
    const transactions = await this.getTransactions(walletAddress, limit);

    const metrics: TransactionMetrics = {
      totalVolume: 0,
      successRate: 0,
      averageAmount: 0,
      uniqueTokens: [],
      programInteractions: new Map()
    };

    if (transactions.length === 0) {
      return metrics;
    }

    let successfulTxs = 0;
    let totalAmount = 0;
    const tokens = new Set<string>();
    const programs = new Map<string, number>();

    // Process each transaction
    transactions.forEach(tx => {
      if (tx.success) successfulTxs++;
      if (tx.amount) totalAmount += tx.amount;
      
      tx.tokenTransfers?.forEach(transfer => {
        tokens.add(transfer.token);
      });

      tx.programIds.forEach(programId => {
        programs.set(programId, (programs.get(programId) || 0) + 1);
      });
    });

    // Calculate metrics
    metrics.totalVolume = totalAmount;
    metrics.successRate = (successfulTxs / transactions.length) * 100;
    metrics.averageAmount = totalAmount / transactions.length;
    metrics.uniqueTokens = Array.from(tokens);
    metrics.programInteractions = programs;
    metrics.timeSpan = {
      first: transactions[transactions.length - 1].timestamp,
      last: transactions[0].timestamp
    };

    return metrics;
  }

  /**
   * Process a single transaction
   */
  private async processTransaction(
    tx: ParsedTransactionWithMeta,
    walletPubkey: PublicKey
  ): Promise<TransactionDetails | null> {
    try {
      if (!tx.blockTime) return null;

      const details: TransactionDetails = {
        signature: tx.transaction.signatures[0],
        timestamp: tx.blockTime,
        success: tx.meta?.err === null,
        programIds: (tx.transaction.message as ParsedMessage).instructions.map((ix) => ix.programId.toString()),
        fee: (tx.meta?.fee || 0) / LAMPORTS_PER_SOL
      };

      // Process token transfers
      if (tx.meta?.postTokenBalances && tx.meta?.preTokenBalances) {
        details.tokenTransfers = await this.processTokenTransfers(
          tx.meta.preTokenBalances,
          tx.meta.postTokenBalances
        );
      }

      // Process SOL transfers
      if (tx.meta?.postBalances && tx.meta?.preBalances) {
        const index = tx.transaction.message.accountKeys.findIndex(
          (key: ParsedMessageAccount) => key.pubkey.equals(walletPubkey)
        );
        if (index !== -1) {
          details.amount = (tx.meta.postBalances[index] - tx.meta.preBalances[index]) / 
            LAMPORTS_PER_SOL;
        }
      } 

      return details;
    } catch (error) {
      elizaLogger.error('Error processing transaction:', error);
      return null;
    }
  }

  /**
   * Process token transfers in a transaction
   */
  private async processTokenTransfers(
    pre: any[],
    post: any[]
  ): Promise<{ token: string; amount: number; decimals: number; }[]> {
    const transfers: { token: string; amount: number; decimals: number; }[] = [];

    for (let i = 0; i < pre.length; i++) {
      const preBalance = pre[i];
      const postBalance = post.find(p => p.accountIndex === preBalance.accountIndex);

      if (postBalance && preBalance.uiTokenAmount.uiAmount !== postBalance.uiTokenAmount.uiAmount) {
        transfers.push({
          token: preBalance.mint,
          amount: postBalance.uiTokenAmount.uiAmount - preBalance.uiTokenAmount.uiAmount,
          decimals: preBalance.uiTokenAmount.decimals
        });
      }
    }

    return transfers;
  }

  /**
   * Validate a public key string
   */
  private isValidPublicKey(key: string): boolean {
    try {
      new PublicKey(key);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear cache for a specific wallet or all caches
   */
  clearCache(walletAddress?: string): void {
    if (walletAddress) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(walletAddress)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}

export type { TransactionDetails, TransactionMetrics };