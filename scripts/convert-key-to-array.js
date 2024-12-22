import bs58 from 'bs58';

const privateKeyBase58 = '';

try {
  const privateKeyBytes = bs58.decode(privateKeyBase58);
  console.log('Private Key (array format):', JSON.stringify(Array.from(privateKeyBytes)));
} catch (error) {
  console.error('Invalid private key:', error.message);
}