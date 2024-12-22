// scripts/convert-key.js
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const secretKey = new Uint8Array([153,10,42,90,73,217,248,255,8,217,74,216,56,55,151,224,32,81,75,145,125,137,21,230,136,182,230,29,217,91,157,43,165,8,114,47,85,65,21,118,125,191,130,102,126,245,138,225,107,73,40,209,24,88,0,173,71,207,253,135,4,73,28,222]);

const keypair = Keypair.fromSecretKey(secretKey);
const privateKeyBase58 = bs58.encode(secretKey);
const publicKey = keypair.publicKey.toString();

console.log('Private Key (base58):', privateKeyBase58);
console.log('Public Key:', publicKey);

// Also save to .env file
console.log('\nAdd these lines to your .env file:');
console.log(`SOLANA_PRIVATE_KEY=${privateKeyBase58}`);
console.log(`SOLANA_PUBKEY=${publicKey}`);