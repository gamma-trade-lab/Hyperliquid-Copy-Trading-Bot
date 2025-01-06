import { Connection, PublicKey, TransactionError } from '@solana/web3.js';
import redisClient from '../../config/inMemoryDB';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_BASE_URL = 'https://api.helius.xyz/v0';
const MAX_RETRIES = 3;
const CACHE_TTL = 3600; // 1 hour cache

interface TransactionSignature {
  signature: string;
  slot: number;
  err: TransactionError | null;
  memo: string | null;
  blockTime?: number | undefined;
}

interface TokenTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number;
  mint: string;
}

interface NativeTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number;
}

interface AccountData {
  account: string;
  nativeBalanceChange: number;
  tokenBalanceChanges: {
    userAccount: string;
    tokenAccount: string;
    mint: string;
    rawTokenAmount: {
      tokenAmount: string;
      decimals: number;
    };
  }[];
}

interface HeliusTransaction {
  signature: string;
  description: string;
  type: string;
  timestamp: number;
  fee: number;
  nativeTransfers: NativeTransfer[];
  tokenTransfers: TokenTransfer[];
  accountData: AccountData[];
  status: 'success' | 'failed';
  source: string;
}

/**
 * Fetches transaction signatures for an address with retry mechanism
 */
async function getSignaturesForAddress(
  address: string,
  limit: number = 100,
  before?: string
): Promise<TransactionSignature[]> {
  const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
  
  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      const options = { limit };
      if (before) {
        options['before'] = before;
      }

      const signatures = await connection.getSignaturesForAddress(
        new PublicKey(address),
        options
      );
      
      return signatures.map(sig => ({
        signature: sig.signature,
        slot: sig.slot,
        err: sig.err,
        memo: sig.memo,
        blockTime: sig.blockTime
      }));
    } catch (error) {
      retries++;
      if (retries === MAX_RETRIES) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * retries));
    }
  }
  return [];
}

/**
 * Fetches detailed transaction data from Helius API
 */
async function getTransactionDetails(signatures: string[]): Promise<HeliusTransaction[]> {
  if (!HELIUS_API_KEY) {
    throw new Error('HELIUS_API_KEY environment variable is not set');
  }

  const url = `${HELIUS_BASE_URL}/transactions`;
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: signatures,
          'api-key': HELIUS_API_KEY,
        }),
      });

      if (!response.ok) {
        throw new Error(`Helius API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      retries++;
      if (retries === MAX_RETRIES) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * retries));
    }
  }
  return [];
}

/**
 * Gets transactions for an address with caching
 */
export async function getTransactionsForAddress(
  address: string,
  limit: number = 100
): Promise<HeliusTransaction[]> {
  const cacheKey = `helius_${address}_${limit}`;
  
  // Try to get from cache first
  const cachedData = await redisClient.get(cacheKey);
  if (cachedData) {
    return JSON.parse(cachedData);
  }

  try {
    // Get signatures first
    const signatures = await getSignaturesForAddress(address, limit);
    
    // Get transaction details
    const transactions = await getTransactionDetails(
      signatures.map(sig => sig.signature)
    );

    // Cache the results
    await redisClient.set(
      cacheKey,
      JSON.stringify(transactions),
      'EX',
      CACHE_TTL
    );

    return transactions;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
}

/**
 * Gets parsed NFT events for an address
 */
export async function getNFTEvents(
  address: string,
  limit: number = 100
): Promise<HeliusTransaction[]> {
  const cacheKey = `helius_nft_${address}_${limit}`;
  
  // Try to get from cache first
  const cachedData = await redisClient.get(cacheKey);
  if (cachedData) {
    return JSON.parse(cachedData);
  }

  try {
    const transactions = await getTransactionsForAddress(address, limit);
    const nftTransactions = transactions.filter(tx => 
      tx.type.toLowerCase().includes('nft')
    );

    // Cache the results
    await redisClient.set(
      cacheKey,
      JSON.stringify(nftTransactions),
      'EX',
      CACHE_TTL
    );

    return nftTransactions;
  } catch (error) {
    console.error('Error fetching NFT events:', error);
    throw error;
  }
}


/**
 * Gets token transfer events for an address
 */
export async function getTokenTransfers(
  address: string,
  limit: number = 100
): Promise<HeliusTransaction[]> {
  const cacheKey = `helius_transfers_${address}_${limit}`;
  
  // Try to get from cache first
  const cachedData = await redisClient.get(cacheKey);
  if (cachedData) {
    return JSON.parse(cachedData);
  }

  try {
    const transactions = await getTransactionsForAddress(address, limit);
    const transferTransactions = transactions.filter(tx => 
      tx.tokenTransfers && tx.tokenTransfers.length > 0
    );

    // Cache the results
    await redisClient.set(
      cacheKey,
      JSON.stringify(transferTransactions),
      'EX',
      CACHE_TTL
    );

    return transferTransactions;
  } catch (error) {
    console.error('Error fetching token transfers:', error);
    throw error;
  }
}

/**
 * Gets Jupiter swap transactions for an address
 */
export async function getJupiterSwaps(
  address: string,
  limit: number = 100
): Promise<HeliusTransaction[]> {
  const cacheKey = `helius_jupiter_${address}_${limit}`;
  
  // Try to get from cache first
  const cachedData = await redisClient.get(cacheKey);
  if (cachedData) {
    return JSON.parse(cachedData);
  }

  try {
    const transactions = await getTransactionsForAddress(address, limit);
    const jupiterSwaps = transactions.filter(tx => 
      tx.source === 'jupiter' || 
      tx.description.toLowerCase().includes('jupiter') ||
      tx.type.toLowerCase().includes('swap')
    );

    // Cache the results
    await redisClient.set(
      cacheKey,
      JSON.stringify(jupiterSwaps),
      'EX',
      CACHE_TTL
    );

    return jupiterSwaps;
  } catch (error) {
    console.error('Error fetching Jupiter swaps:', error);
    throw error;
  }
}
