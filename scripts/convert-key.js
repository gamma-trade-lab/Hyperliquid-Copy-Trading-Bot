// scripts/convert-key.js
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const secretKey = new Uint8Array();

const keypair = Keypair.fromSecretKey(secretKey);
const privateKeyBase58 = bs58.encode(secretKey);
const publicKey = keypair.publicKey.toString();

console.log('Private Key (base58):', privateKeyBase58);
console.log('Public Key:', publicKey);

// Also save to .env file
console.log('\nAdd these lines to your .env file:');
console.log(`SOLANA_PRIVATE_KEY=${privateKeyBase58}`);
console.log(`SOLANA_PUBKEY=${publicKey}`);