import bs58 from 'bs58';

const privateKeyBase58 = '';

try {
  const privateKeyBytes = bs58.decode(privateKeyBase58);
  if (privateKeyBytes.length !== 64) {
    throw new Error('Invalid private key length');
  }
  console.log('Private key is valid');
} catch (error) {
  console.error('Invalid private key:', error.message);
}