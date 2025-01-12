import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import * as fs from 'fs';
import { elizaLogger } from "@ai16z/eliza";

export interface KeypairResult {
    keypair?: Keypair;
    publicKey?: PublicKey;
}

export interface KeypairConfig {
    requirePrivateKey: boolean;
    keyPath?: string;
    publicKeyString?: string;
}

/**
 * Gets either a keypair or public key based on configuration
 * @param config Configuration options for keypair generation/loading
 * @returns KeypairResult containing either keypair or public key
 */
export async function getWalletKey(runtime: unknown, p0: boolean, config: KeypairConfig): Promise<KeypairResult> {
    try {
        if (config.requirePrivateKey) {
            if (!config.keyPath) {
                throw new Error('Keypair path required when requirePrivateKey is true');
            }
            const keypair = await loadKeypairFromFile(config.keyPath);
            return { keypair, publicKey: keypair.publicKey };
        } else {
            if (!config.publicKeyString) {
                throw new Error('Public key string required when requirePrivateKey is false');
            }
            const publicKey = new PublicKey(config.publicKeyString);
            return { publicKey };
        }
    } catch (error) {
        elizaLogger.error('Failed to get wallet key:', error);
        throw error;
    }
}

/**
 * Loads a keypair from a file
 * @param path Path to keypair file
 * @returns Loaded Keypair
 */
async function loadKeypairFromFile(path: string): Promise<Keypair> {
    try {
        const data = await fs.promises.readFile(path, 'utf-8');
        const secretKey = bs58.decode(data.trim());
        return Keypair.fromSecretKey(secretKey);
    } catch (error) {
        elizaLogger.error('Failed to load keypair from file:', error);
        throw error;
    }
}
