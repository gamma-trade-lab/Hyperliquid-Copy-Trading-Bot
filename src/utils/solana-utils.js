//src/utils/solana-utils.ts
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
export function isValidSolanaPrivateKey(privateKey) {
    try {
        const decoded = bs58.decode(privateKey);
        if (decoded.length !== 64)
            return false;
        // Try to create a keypair from it
        const keypair = Keypair.fromSecretKey(decoded);
        return Boolean(keypair.publicKey);
    }
    catch {
        return false;
    }
}
export function getKeypairFromPrivateKey(privateKey) {
    const decoded = bs58.decode(privateKey);
    return Keypair.fromSecretKey(decoded);
}
