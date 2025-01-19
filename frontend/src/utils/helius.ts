import { getSolanaPrice } from "./coingecko";
import logger from "./logger";


// Types
interface BalanceResponse {
  balance: number;
  balanceInUSD: number;
  timestamp: string;
}

interface TransactionDetail {
  type: string;
  timestamp: string;
  status: 'Success' | 'Failed';
  amount?: number;
  sender?: string;
  receiver?: string;
  fee?: number;
  tokenTransfer?: TokenTransfer;
}

interface TokenTransfer {
  amount: number;
  symbol: string;
  tokenAddress?: string;
  decimals?: number;
}

interface TokenAmount {
  uiAmount: number | null;
  uiTokenSymbol: string | null;
  decimals?: number;
}

interface TokenBalance {
  accountIndex: number;
  uiTokenAmount: TokenAmount;
  mint?: string;
}

interface HeliusError extends Error {
  code?: number;
  data?: any;
}

// Rate limiter with exponential backoff
class RateLimiter {
  private lastRequest: number = 0;
  private retryCount: number = 0;
  private readonly minInterval: number = 100;
  private readonly maxRetries: number = 3;
  private readonly backoffMultiplier: number = 1.5;

  async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;

    if (timeSinceLastRequest < this.minInterval) {
      await new Promise(resolve => 
        setTimeout(resolve, this.minInterval - timeSinceLastRequest)
      );
    }
    
    this.lastRequest = Date.now();
  }

  async handleError(error: HeliusError): Promise<void> {
    this.retryCount++;
    
    if (this.retryCount > this.maxRetries) {
      this.retryCount = 0;
      throw error;
    }

    const backoffTime = this.minInterval * 
      Math.pow(this.backoffMultiplier, this.retryCount);
    
    await new Promise(resolve => setTimeout(resolve, backoffTime));
  }

  reset(): void {
    this.retryCount = 0;
  }
}

const rateLimiter = new RateLimiter();

/**
 * Get Helius RPC URL with API key
 */
function getHeliusRpcUrl(): string {
  const apiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
  if (!apiKey) {
    throw new Error('HELIUS_API_KEY is not configured');
  }
  return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
}

/**
 * Get Solana balance for an address
 */
export async function getSolanaBalance(address: string): Promise<BalanceResponse> {
  if (!address) {
    throw new Error('Address is required');
  }

  try {
    await rateLimiter.throttle();

    const heliusUrl = getHeliusRpcUrl();
    
    const response = await fetch(heliusUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'balance-request',
        method: 'getBalance',
        params: [address],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      const error = new Error(`Helius API error: ${data.error.message}`) as HeliusError;
      error.code = data.error.code;
      error.data = data.error.data;
      throw error;
    }

    const balanceInSOL = Number(data.result?.value || 0) / 1e9;
    const priceData = await getSolanaPrice();
    
    return {
      balance: balanceInSOL,
      balanceInUSD: balanceInSOL * priceData.price,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error in getSolanaBalance:', error);
    
    if (error instanceof Error) {
      await rateLimiter.handleError(error as HeliusError);
    }
    
    throw error;
  }
}

/**
 * Get transaction details by signature
 */
export async function getTransactionDetails(signature: string): Promise<TransactionDetail> {
  try {
    await rateLimiter.throttle();

    const heliusUrl = getHeliusRpcUrl();
    
    const response = await fetch(heliusUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'tx-request',
        method: 'getTransaction',
        params: [
          signature,
          { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      const error = new Error(`Helius API error: ${data.error.message}`) as HeliusError;
      error.code = data.error.code;
      error.data = data.error.data;
      throw error;
    }

    const tx = data.result;
    if (!tx) {
      throw new Error('Transaction not found');
    }

    const tokenTransfer = parseTokenTransfers(tx);

    return {
      type: tx.meta?.type || 'Unknown',
      timestamp: new Date(tx.blockTime * 1000).toISOString(),
      status: tx.meta?.err ? 'Failed' : 'Success',
      amount: calculateTransactionAmount(tx),
      fee: calculateTransactionFee(tx),
      sender: tx.transaction?.message?.accountKeys?.[0],
      receiver: tx.transaction?.message?.accountKeys?.[1],
      tokenTransfer
    };
  } catch (error) {
    logger.error('Error fetching transaction details:', error);
    
    if (error instanceof Error) {
      await rateLimiter.handleError(error as HeliusError);
    }
    
    throw error;
  }
}

/**
 * Parse token transfers from transaction
 */
function parseTokenTransfers(tx: any): TokenTransfer | undefined {
  try {
    if (!tx.meta?.postTokenBalances?.length && !tx.meta?.preTokenBalances?.length) {
      return undefined;
    }

    const postBalances = tx.meta.postTokenBalances as TokenBalance[] || [];
    const preBalances = tx.meta.preTokenBalances as TokenBalance[] || [];

    for (let i = 0; i < Math.max(postBalances.length, preBalances.length); i++) {
      const postBalance = postBalances[i];
      const preBalance = preBalances.find(
        (pre: TokenBalance) => pre.accountIndex === postBalance?.accountIndex
      );

      if (postBalance?.uiTokenAmount && preBalance?.uiTokenAmount) {
        const amount = Math.abs(
          (postBalance.uiTokenAmount.uiAmount || 0) - 
          (preBalance.uiTokenAmount.uiAmount || 0)
        );

        if (amount > 0) {
          return {
            amount,
            symbol: postBalance.uiTokenAmount.uiTokenSymbol || 'Unknown',
            tokenAddress: tx.transaction?.message?.accountKeys?.[postBalance.accountIndex],
            decimals: postBalance.uiTokenAmount.decimals
          };
        }
      }
    }
  } catch (error) {
    logger.error('Error parsing token transfers:', error);
  }
  
  return undefined;
}

/**
 * Calculate transaction amount
 */
function calculateTransactionAmount(tx: any): number {
  try {
    const postBalance = tx.meta?.postBalances?.[0] || 0;
    const preBalance = tx.meta?.preBalances?.[0] || 0;
    return (postBalance - preBalance) / 1e9;
  } catch (error) {
    logger.error('Error calculating transaction amount:', error);
    return 0;
  }
}

/**
 * Calculate transaction fee
 */
function calculateTransactionFee(tx: any): number | undefined {
  try {
    return tx.meta?.fee ? tx.meta.fee / 1e9 : undefined;
  } catch (error) {
    logger.error('Error calculating transaction fee:', error);
    return undefined;
  }
}

// Export types
export type { 
  BalanceResponse, 
  TransactionDetail, 
  TokenTransfer,  
  HeliusError 
};