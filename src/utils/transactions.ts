// src/utils/transactions.ts

import {
  Connection,
  Transaction,
  ComputeBudgetProgram,
  TransactionInstruction
} from '@solana/web3.js';

interface TransactionOptions {
  maxRetries?: number;
  priorityFee?: number;
  computeUnits?: number;
  skipPreflight?: boolean;
  confirmationStrategy?: 'processed' | 'confirmed' | 'finalized';
}

interface TransactionResult {
  signature: string;
  error?: string;
  retries: number;
  confirmationTime?: number;
}

export async function createTransaction(
  connection: Connection,
  instructions: TransactionInstruction[],
  options: TransactionOptions = {}
): Promise<Transaction> {
  const transaction = new Transaction();
  
  // Add compute budget if specified
  if (options.computeUnits) {
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: options.computeUnits
    });
    transaction.add(computeBudgetIx);
  }

  // Add priority fee if specified
  if (options.priorityFee) {
    const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: options.priorityFee
    });
    transaction.add(priorityFeeIx);
  }

  // Add provided instructions
  instructions.forEach(ix => transaction.add(ix));

  // Get latest blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  return transaction;
}

export async function signAndSendTransaction(
  connection: Connection,
  transaction: Transaction,
  options: TransactionOptions = {}
): Promise<string> {
  const {
    maxRetries = 3,
    skipPreflight = false,
    confirmationStrategy = 'confirmed'
  } = options;

  let retries = 0;
  let lastError: Error | undefined;

  while (retries < maxRetries) {
    try {
      const signature = await connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight,
          maxRetries: 1
        }
      );

      // Wait for confirmation
      await connection.confirmTransaction(signature, confirmationStrategy);

      return signature;

    } catch (error) {
      lastError = error as Error;
      retries++;

      if (retries < maxRetries) {
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, retries) * 1000)
        );
      }
    }
  }

  throw new Error(
    `Transaction failed after ${retries} retries. Last error: ${lastError?.message}`
  );
}

export async function simulateTransaction(
  connection: Connection,
  transaction: Transaction
): Promise<boolean> {
  try {
    const simulation = await connection.simulateTransaction(transaction);
    return !simulation.value.err;
  } catch (error) {
    console.error('Transaction simulation failed:', error);
    return false;
  }
}

export async function getRecentPriorityFee(
  connection: Connection
): Promise<number> {
  try {
    const fees = await connection.getRecentPrioritizationFees();
    if (fees.length === 0) return 0;
    
    // Calculate average fee from recent transactions
    const avgFee = fees.reduce((sum, fee) => 
      sum + fee.prioritizationFee, 0) / fees.length;
    
    return Math.ceil(avgFee * 1.2); // Add 20% buffer
  } catch (error) {
    console.error('Error getting priority fee:', error);
    return 0;
  }
}
