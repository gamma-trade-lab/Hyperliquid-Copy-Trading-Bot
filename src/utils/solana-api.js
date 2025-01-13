import { clusterApiUrl, Connection } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createTransferInstruction } from './spl-token/index.js';
export class SolanaAPI {
    connection;
    constructor(network = 'devnet') {
        this.connection = new Connection(clusterApiUrl(network));
    }
    async getAssociatedTokenAddress(mint, owner) {
        return getAssociatedTokenAddress(mint, owner);
    }
    async createTransferInstruction(source, destination, owner, amount) {
        return createTransferInstruction(source, destination, owner, amount, [], TOKEN_PROGRAM_ID);
    }
}
// Export a singleton instance
export const solanaAPI = new SolanaAPI();
