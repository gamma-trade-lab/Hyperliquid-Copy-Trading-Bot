import bs58 from 'bs58';

const privateKeyBase58 = '44U1iRUPUPtyX2qY8jUw1ER3sEdaCodkZxEc2KBoouaEcBPvoqAdomvHhUCTF1HJASq5qLZRUssXiXGuYnPTzkyT';

try {
  const privateKeyBytes = bs58.decode(privateKeyBase58);
  if (privateKeyBytes.length !== 64) {
    throw new Error('Invalid private key length');
  }
  console.log('Private key is valid');
} catch (error) {
  console.error('Invalid private key:', error.message);
}