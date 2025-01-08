import { clusterApiUrl, Connection, PublicKey } from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createTransferInstruction
} from './spl-token/index.js';

export class SolanaAPI {
  private connection: Connection;
  
  constructor(network: 'devnet' | 'mainnet-beta' = 'devnet') {
    this.connection = new Connection(clusterApiUrl(network));
  }

  async getAssociatedTokenAddress(
    mint: PublicKey,
    owner: PublicKey
  ): Promise<PublicKey> {
    return getAssociatedTokenAddress(
      mint,
      owner
    );
  }

  async createTransferInstruction(
    source: PublicKey,
    destination: PublicKey,
    owner: PublicKey,
    amount: number
  ) {
    return createTransferInstruction(
      source,
      destination,
      owner,
      amount,
      [],
      TOKEN_PROGRAM_ID
    );
  }

  // Add other needed Solana/SPL methods here
}

// Export a singleton instance
export const solanaAPI = new SolanaAPI();
