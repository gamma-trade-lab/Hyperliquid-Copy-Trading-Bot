// src/services/blockchain/index.ts
import { Connection, PublicKey } from '@solana/web3.js';
import { createTransaction, signAndSendTransaction } from '../../utils/transactions.js';
export class BlockchainService {
    connection;
    constructor(config) {
        this.connection = new Connection(config.rpcUrl, 'confirmed');
    }
    async createTokenTransaction(instructions) {
        try {
            return await createTransaction(this.connection, instructions);
        }
        catch (error) {
            console.error('Error creating token transaction:', error);
            throw error;
        }
    }
    async sendTransaction(transaction) {
        try {
            return await signAndSendTransaction(this.connection, transaction);
        }
        catch (error) {
            console.error('Error sending transaction:', error);
            throw error;
        }
    }
    async getBalance(address) {
        try {
            const publicKey = new PublicKey(address);
            return await this.connection.getBalance(publicKey);
        }
        catch (error) {
            console.error('Error getting balance:', error);
            throw error;
        }
    }
    isValidAddress(address) {
        try {
            new PublicKey(address);
            return true;
        }
        catch {
            return false;
        }
    }
    getConnection() {
        return this.connection;
    }
}
// Export everything from the blockchain module
export * from './solana.js';
export * from './types.js';
export default BlockchainService;
