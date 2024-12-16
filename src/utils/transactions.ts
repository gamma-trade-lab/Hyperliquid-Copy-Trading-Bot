// src/utils/transactions.ts

import {
    Connection,
    Transaction,
    VersionedTransaction,
    PublicKey,
    ComputeBudgetProgram,
    SendTransactionError
  } from '@solana/web3.js';
  import { JitoClient } from '@jito-foundation/sdk';
  import { HeliusApi } from 'helius-sdk';
  
  interface TransactionOptions {
    maxRetries?: number;
    priorityFee?: number;
    useJito?: boolean;
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
  
  export class TransactionUtils {
    private connection: Connection;
    private jitoClient?: JitoClient;
    private helius: HeliusApi;
  
    constructor(
      connection: Connection,
      heliusApiKey: string,
      jitoEndpoint?: string
    ) {
      this.connection = connection;
      this.helius = new HeliusApi(heliusApiKey);
  
      if (jitoEndpoint) {
        this.jitoClient = new JitoClient(jitoEndpoint);
      }
    }
  
    async sendTransaction(
      transaction: Transaction | VersionedTransaction,
      options: TransactionOptions = {}
    ): Promise<TransactionResult> {
      const {
        maxRetries = 3,
        priorityFee,
        useJito = false,
        computeUnits = 200000,
        skipPreflight = false,
        confirmationStrategy = 'confirmed'
      } = options;
  
      let retries = 0;
      let lastError: Error | undefined;
      const startTime = Date.now();
  
      while (retries < maxRetries) {
        try {
          // Add priority fee if specified
          if (priorityFee) {
            transaction = await this.addPriorityFee(transaction, priorityFee);
          }
  
          // Add compute units budget
          transaction = await this.addComputeBudget(transaction, computeUnits);
  
          let signature: string;
  
          if (useJito && this.jitoClient) {
            signature = await this.sendWithJito(transaction);
          } else {
            signature = await this.sendWithRetry(transaction, {
              skipPreflight,
              maxRetries: 1
            });
          }
  
          // Wait for confirmation
          await this.waitForConfirmation(signature, confirmationStrategy);
  
          return {
            signature,
            retries,
            confirmationTime: Date.now() - startTime
          };
  
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
  
    async sendTransactionBundle(
      transactions: Transaction[],
      options: TransactionOptions = {}
    ): Promise<string[]> {
      if (!this.jitoClient) {
        throw new Error('Jito client not initialized');
      }
  
      try {
        // Prepare transactions with compute budget and priority fees
        const preparedTxns = await Promise.all(
          transactions.map(async tx => {
            let prepared = tx;
            if (options.priorityFee) {
              prepared = await this.addPriorityFee(prepared, options.priorityFee);
            }
            if (options.computeUnits) {
              prepared = await this.addComputeBudget(prepared, options.computeUnits);
            }
            return prepared;
          })
        );
  
        // Send bundle through Jito
        const signatures = await this.jitoClient.sendBundle(preparedTxns);
  
        // Wait for confirmations
        await Promise.all(
          signatures.map(sig => 
            this.waitForConfirmation(sig, options.confirmationStrategy)
          )
        );
  
        return signatures;
  
      } catch (error) {
        console.error('Error sending transaction bundle:', error);
        throw error;
      }
    }
  
    private async addPriorityFee(
      transaction: Transaction | VersionedTransaction,
      priorityFee: number
    ): Promise<Transaction | VersionedTransaction> {
      // Get recommended priority fee from Helius
      const recommendedFee = await this.helius.getPriorityFee();
      const actualFee = Math.min(priorityFee, recommendedFee);
  
      const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: actualFee
      });
  
      if (transaction instanceof VersionedTransaction) {
        transaction.message.compiledInstructions.unshift(
          priorityFeeIx.data as any
        );
      } else {
        transaction.instructions.unshift(priorityFeeIx);
      }
  
      return transaction;
    }
  
    private async addComputeBudget(
      transaction: Transaction | VersionedTransaction,
      computeUnits: number
    ): Promise<Transaction | VersionedTransaction> {
      const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: computeUnits
      });
  
      if (transaction instanceof VersionedTransaction) {
        transaction.message.compiledInstructions.unshift(
          computeBudgetIx.data as any
        );
      } else {
        transaction.instructions.unshift(computeBudgetIx);
      }
  
      return transaction;
    }
  
    private async sendWithJito(
      transaction: Transaction | VersionedTransaction
    ): Promise<string> {
      if (!this.jitoClient) {
        throw new Error('Jito client not initialized');
      }
  
      return await this.jitoClient.sendTransaction(transaction);
    }
  
    private async sendWithRetry(
      transaction: Transaction | VersionedTransaction,
      options: { skipPreflight: boolean; maxRetries: number }
    ): Promise<string> {
      return await this.connection.sendRawTransaction(
        transaction instanceof VersionedTransaction
          ? transaction.serialize()
          : transaction.serialize(),
        {
          skipPreflight: options.skipPreflight,
          maxRetries: options.maxRetries
        }
      );
    }
  
    private async waitForConfirmation(
      signature: string,
      strategy: 'processed' | 'confirmed' | 'finalized' = 'confirmed'
    ): Promise<void> {
      await this.connection.confirmTransaction({
        signature,
        ...(strategy === 'processed' && { processed: true }),
        ...(strategy === 'confirmed' && { confirmed: true }),
        ...(strategy === 'finalized' && { finalized: true })
      });
    }
  
    async simulateTransaction(
      transaction: Transaction | VersionedTransaction
    ): Promise<boolean> {
      try {
        const simulation = await this.connection.simulateTransaction(transaction);
        return !simulation.value.err;
      } catch (error) {
        console.error('Transaction simulation failed:', error);
        return false;
      }
    }
  
    async getOptimalPriorityFee(): Promise<number> {
      try {
        return await this.helius.getPriorityFee();
      } catch (error) {
        console.error('Error getting priority fee:', error);
        return 0;
      }
    }
  }