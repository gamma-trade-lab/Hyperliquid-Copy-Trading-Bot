// src/utils/config-validator.ts
import { PublicKey } from '@solana/web3.js';
import { NetworkType } from '../config/constants.js';
import { elizaLogger } from "@ai16z/eliza";

export function validatePrivateKey(privateKey: string): boolean {
  try {
    if (privateKey.startsWith('[') && privateKey.endsWith(']')) {
      const numbers = JSON.parse(privateKey);
      return Array.isArray(numbers) && 
             numbers.length === 64 && 
             numbers.every(n => typeof n === 'number' && n >= 0 && n <= 255);
    }
    return false;
  } catch {
    return false;
  }
}

function isValidPublicKey(key: string): boolean {
  try {
    new PublicKey(key);
    return true;
  } catch {
    return false;
  }
}

export function validateConfig(config: any, path = ''): void {
  if (path === 'SOLANA') {
    // Validate Solana configuration
    if (!config.NETWORK) {
      throw new Error('SOLANA.NETWORK is required');
    }

    if (!config.RPC_URL) {
      throw new Error('SOLANA.RPC_URL is required');
    }

    if (!config.PUBLIC_KEY || !isValidPublicKey(config.PUBLIC_KEY)) {
      throw new Error('Invalid SOLANA.PUBLIC_KEY');
    }

    if (!config.PRIVATE_KEY) {
      throw new Error('SOLANA.PRIVATE_KEY is required');
    }

    if (!config.helius?.API_KEY) {
      throw new Error('SOLANA.helius.API_KEY is required');
    }

    return;
  }

  // Recursively validate nested objects
  if (typeof config === 'object' && config !== null) {
    Object.entries(config).forEach(([key, value]) => {
      const newPath = path ? `${path}.${key}` : key;
      validateConfig(value, newPath);
    });
  }
}