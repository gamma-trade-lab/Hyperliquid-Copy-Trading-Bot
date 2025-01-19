import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction } from '@solana/web3.js';
import { validateSolanaAddress } from './validation';

// Constants
const DEVNET_CONFIG = {
  ENDPOINT: 'https://api.devnet.solana.com',
  DEFAULT_AMOUNT: LAMPORTS_PER_SOL,
  MAX_RETRIES: 3,
  CONFIRM_TIMEOUT: 30000,
  RETRY_DELAY: 1000,
  MAX_DAILY_AIRDROPS: 5 
} as const;

// Types
interface AirdropResult {
  status: 'success' | 'error';
  signature?: string;
  message?: AirdropErrorType;
  balance?: number;
}

type AirdropErrorType = 
  | 'invalid_address'
  | 'daily_limit_reached'
  | 'airdrop_failed'
  | 'connection_failed'
  | 'confirmation_timeout'
  | 'already_sufficient_balance';

interface AirdropOptions {
  amount?: number;
  skipBalanceCheck?: boolean;
  confirmationTimeout?: number;
}

// Rate limiting and tracking
class AirdropTracker {
  private airdrops = new Map<string, {
    count: number;
    lastReset: number;
  }>();

  private getKey(address: string): string {
    return `${address}_${new Date().toDateString()}`;
  }

  canAirdrop(address: string): boolean {
    const key = this.getKey(address);
    const record = this.airdrops.get(key);

    if (!record) {
      this.airdrops.set(key, {
        count: 0,
        lastReset: Date.now()
      });
      return true;
    }

    // Reset counter if it's a new day
    if (new Date().toDateString() !== new Date(record.lastReset).toDateString()) {
      this.airdrops.set(key, {
        count: 0,
        lastReset: Date.now()
      });
      return true;
    }

    return record.count < DEVNET_CONFIG.MAX_DAILY_AIRDROPS;
  }

  recordAirdrop(address: string): void {
    const key = this.getKey(address);
    const record = this.airdrops.get(key);

    if (record) {
      record.count++;
    } else {
      this.airdrops.set(key, {
        count: 1,
        lastReset: Date.now()
      });
    }
  }

  getRemainingAirdrops(address: string): number {
    const key = this.getKey(address);
    const record = this.airdrops.get(key);

    if (!record) return DEVNET_CONFIG.MAX_DAILY_AIRDROPS;
    return Math.max(0, DEVNET_CONFIG.MAX_DAILY_AIRDROPS - record.count);
  }
}

// Initialize connection and tracker
const DEVNET_CONNECTION = new Connection(DEVNET_CONFIG.ENDPOINT, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: DEVNET_CONFIG.CONFIRM_TIMEOUT
});

const airdropTracker = new AirdropTracker();

/**
 * Request SOL airdrop on devnet
 */
export async function requestDevnetAirdrop(
  address: string,
  options: AirdropOptions = {}
): Promise<AirdropResult> {
  try {
    // Validate address
    if (!validateSolanaAddress(address)) {
      return {
        status: 'error',
        message: 'invalid_address'
      };
    }

    const publicKey = new PublicKey(address);
    const amount = options.amount || DEVNET_CONFIG.DEFAULT_AMOUNT;

    // Check daily limit
    if (!airdropTracker.canAirdrop(address)) {
      return {
        status: 'error',
        message: 'daily_limit_reached'
      };
    }

    // Check current balance unless explicitly skipped
    if (!options.skipBalanceCheck) {
      const currentBalance = await DEVNET_CONNECTION.getBalance(publicKey);
      if (currentBalance >= amount) {
        return {
          status: 'error',
          message: 'already_sufficient_balance',
          balance: currentBalance / LAMPORTS_PER_SOL
        };
      }
    }

    // Request airdrop with retries
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= DEVNET_CONFIG.MAX_RETRIES; attempt++) {
      try {
        const signature = await DEVNET_CONNECTION.requestAirdrop(
          publicKey,
          amount
        );

        // Wait for confirmation
        const confirmation = await DEVNET_CONNECTION.confirmTransaction(
          signature,
          'confirmed'
        );

        if (confirmation.value.err) {
          throw new Error('Transaction failed to confirm');
        }

        // Record successful airdrop
        airdropTracker.recordAirdrop(address);

        // Get updated balance
        const newBalance = await DEVNET_CONNECTION.getBalance(publicKey);

        return {
          status: 'success',
          signature,
          balance: newBalance / LAMPORTS_PER_SOL
        };
      } catch (error) {
        lastError = error as Error;
        console.warn(`Airdrop attempt ${attempt} failed:`, error);
        
        if (attempt < DEVNET_CONFIG.MAX_RETRIES) {
          await new Promise(resolve => 
            setTimeout(resolve, DEVNET_CONFIG.RETRY_DELAY * attempt)
          );
        }
      }
    }

    // Handle specific error messages
    if (lastError?.message?.includes('airdrop request limit reached')) {
      return {
        status: 'error',
        message: 'daily_limit_reached'
      };
    }

    return {
      status: 'error',
      message: 'airdrop_failed'
    };
  } catch (error) {
    console.error('Airdrop error:', error);
    return {
      status: 'error',
      message: error instanceof Error ? 'connection_failed' : 'airdrop_failed'
    };
  }
}

/**
 * Get remaining airdrops for an address
 */
export function getRemainingAirdrops(address: string): number {
  return airdropTracker.getRemainingAirdrops(address);
}

// Export types
export type { AirdropResult, AirdropOptions, AirdropErrorType };