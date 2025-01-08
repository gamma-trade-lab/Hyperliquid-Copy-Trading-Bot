// src/utils/config-validator.ts
import { PublicKey } from '@solana/web3.js';
import { NetworkType } from '../config/constants.js';

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

export function validateConfig(config: any): void {
  const requiredFields: { [key: string]: (value: any) => boolean } = {
    'SOLANA.NETWORK': (v: string) => Object.values(NetworkType).includes(v as NetworkType),
    'SOLANA.RPC_URL': (v: string) => v.startsWith('http'),
    'SOLANA.PRIVATE_KEY': validatePrivateKey,
    'SOLANA.PUBKEY': (v: string) => {
      try {
        new PublicKey(v);
        return true;
      } catch {
        return false;
      }
    },
    'SOLANA.TOKEN_SETTINGS.DECIMALS': (v: number) => !isNaN(v) && v >= 0,
    'SOLANA.TRADING.BASE_AMOUNT': (v: number) => !isNaN(v) && v > 0,
    'SOLANA.TRADING.MIN_CONFIDENCE': (v: number) => !isNaN(v) && v >= 0 && v <= 1,
    'SOLANA.TRADING.SLIPPAGE': (v: number) => !isNaN(v) && v >= 0 && v <= 1,
    'AI.GROQ.MAX_TOKENS': (v: number) => !isNaN(v) && v > 0,
    'AUTOMATION.CONTENT_GENERATION_INTERVAL': (v: number) => !isNaN(v) && v > 0,
    'AUTOMATION.MARKET_MONITORING_INTERVAL': (v: number) => !isNaN(v) && v > 0,
    'AUTOMATION.COMMUNITY_ENGAGEMENT_INTERVAL': (v: number) => !isNaN(v) && v > 0
  };

  for (const [path, validator] of Object.entries(requiredFields)) {
    const value = path.split('.').reduce((obj, key) => obj?.[key], config);
    if (value === undefined || !validator(value)) {
      throw new Error(`Invalid configuration for ${path}`);
    }
  }
}