import bs58 from 'bs58';

const privateKeyBase58 = '4BuZoFfiejY1Y137r4g8j9tfXHvCqkzEsYQmHZxaamqBNU13osYaYpCtuk9K48xnfgLupQiHEVqP4wfxbwSYYN6p';

try {
  const privateKeyBytes = bs58.decode(privateKeyBase58);
  console.log('Private Key (array format):', JSON.stringify(Array.from(privateKeyBytes)));
} catch (error) {
  console.error('Invalid private key:', error.message);
}