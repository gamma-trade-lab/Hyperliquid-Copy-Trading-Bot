import { clusterApiUrl, Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';

export class SolanaAPI {
  private connection: Connection;
  
  constructor(network: 'devnet' | 'mainnet-beta' = 'devnet') {
    this.connection = new Connection(clusterApiUrl(network));
  }

  async getAssociatedTokenAddress(
    mint: PublicKey,
    owner: PublicKey
  ): Promise<PublicKey> {
    return Token.getAssociatedTokenAddress(
      TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
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
    return Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      source,
      destination,
      owner,
      [],
      amount
    );
  }

  // Add other needed Solana/SPL methods here
}

// Export a singleton instance
export const solanaAPI = new SolanaAPI();