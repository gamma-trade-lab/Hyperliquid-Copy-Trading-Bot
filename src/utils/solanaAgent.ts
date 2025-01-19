import { SolanaAgentKit, createSolanaTools } from "solana-agent-kit";
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { elizaLogger } from "@ai16z/eliza";
import { CONFIG } from '../config/settings.js';

export const agentKit = new SolanaAgentKit(
  process.env.SOLANA_PRIVATE_KEY!,
  process.env.RPC_URL!,
  { OPENAI_API_KEY: process.env.OPENAI_API_KEY! },
);

export class SolanaAgentUtils {
  private connection: Connection;
  private keypair: Keypair;

  constructor() {
    this.connection = new Connection(CONFIG.SOLANA.RPC_URL);
    this.keypair = this.initializeKeypair();
  }

  private initializeKeypair(): Keypair {
    try {
      if (!process.env.SOLANA_PRIVATE_KEY) {
        throw new Error('SOLANA_PRIVATE_KEY not found in environment');
      }

      const privateKeyArray = JSON.parse(process.env.SOLANA_PRIVATE_KEY);
      return Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
    } catch (error) {
      elizaLogger.error('Error initializing Solana keypair:', error);
      throw error;
    }
  }

  async getBalance(pubkey?: string): Promise<number> {
    try {
      const address = pubkey ? new PublicKey(pubkey) : this.keypair.publicKey;
      const balance = await this.connection.getBalance(address);
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      elizaLogger.error('Error getting balance:', error);
      throw error;
    }
  }

  async validateTransaction(signature: string) {
    try {
      const result = await this.connection.confirmTransaction(signature);
      return result.value;
    } catch (error) {
      elizaLogger.error('Error validating transaction:', error);
      throw error;
    }
  }

  getConnection(): Connection {
    return this.connection;
  }

  getKeypair(): Keypair {
    return this.keypair;
  }
}

// Export singleton instance
export const solanaUtils = new SolanaAgentUtils();
export const solanaTools = createSolanaTools(agentKit);