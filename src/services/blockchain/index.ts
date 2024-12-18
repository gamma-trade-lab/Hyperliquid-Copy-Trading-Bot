// src/services/blockchain/index.ts

import { Connection, PublicKey, TransactionInstruction, Transaction } from '@solana/web3.js';
import type { WalletService } from './types';
import { createTransaction, signAndSendTransaction } from '../../utils/transactions';

export interface BlockchainConfig {
  rpcUrl: string;
  walletPrivateKey?: string;
}

export class BlockchainService {
  private connection: Connection;

  constructor(config: BlockchainConfig) {
    this.connection = new Connection(config.rpcUrl, 'confirmed');
  }

  async createTokenTransaction(instructions: TransactionInstruction[]): Promise<Transaction> {
    try {
      return await createTransaction(this.connection, instructions);
    } catch (error) {
      console.error('Error creating token transaction:', error);
      throw error;
    }
  }

  async sendTransaction(transaction: Transaction): Promise<string> {
    try {
      return await signAndSendTransaction(this.connection, transaction);
    } catch (error) {
      console.error('Error sending transaction:', error);
      throw error;
    }
  }

  async getBalance(address: string) {
    try {
      const publicKey = new PublicKey(address);
      return await this.connection.getBalance(publicKey);
    } catch (error) {
      console.error('Error getting balance:', error);
      throw error;
    }
  }

  isValidAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  getConnection(): Connection {
    return this.connection;
  }
}

// Export everything from the blockchain module
export * from './solana';
export * from './types';
export default BlockchainService;