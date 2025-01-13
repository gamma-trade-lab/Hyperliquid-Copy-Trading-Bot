// src/utils/solana-validator.ts
import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
export function validateSolanaConfig(config) {
    try {
        console.log('Validating Solana configuration...');
        // Validate RPC URL
        if (!config.RPC_URL.startsWith('http')) {
            throw new Error('Invalid RPC URL format');
        }
        // Validate public key
        try {
            new PublicKey(config.PUBLIC_KEY);
            console.log('Public key is valid');
        }
        catch {
            throw new Error('Invalid public key format');
        }
        // Validate private key
        try {
            let privateKeyBytes;
            if (config.PRIVATE_KEY.includes('[')) {
                // Handle array format
                const numbers = JSON.parse(config.PRIVATE_KEY);
                privateKeyBytes = new Uint8Array(numbers);
            }
            else {
                // Handle base58 format
                privateKeyBytes = bs58.decode(config.PRIVATE_KEY);
            }
            const keypair = Keypair.fromSecretKey(privateKeyBytes);
            const derivedPubkey = keypair.publicKey.toString();
            if (derivedPubkey !== config.PUBLIC_KEY) {
                throw new Error('Private key does not match public key');
            }
            console.log('Private key is valid and matches public key');
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Invalid private key: ${error.message}`);
            }
            else {
                throw new Error('Invalid private key');
            }
        }
        console.log('Solana configuration is valid');
        return true;
    }
    catch (error) {
        console.error('Solana configuration validation failed:', error);
        throw error;
    }
}
