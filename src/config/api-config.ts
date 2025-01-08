export const API_CONFIG = {
  HELIUS: {
    API_KEY: process.env.NEXT_PUBLIC_HELIUS_API_KEY,
    BASE_URL: 'https://mainnet.helius-rpc.com',
    RATE_LIMIT: {
      REQUESTS_PER_SECOND: 10,
      MIN_INTERVAL: 100 // ms
    }
  },
  JUPITER: {
    BASE_URL: 'https://quote-api.jup.ag/v6',
    TOKENS_URL: 'https://tokens.jup.ag',
    PRICE_URL: 'https://price.jup.ag/v4',
    DEFAULT_SLIPPAGE: 50, // 0.5%
    HIGH_SLIPPAGE: 1000,  // 10% for low liquidity tokens
    RATE_LIMIT: {
      REQUESTS_PER_SECOND: 5,
      MIN_INTERVAL: 200 // ms
    }
  }
};

export const KNOWN_TOKENS = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  SOL: 'So11111111111111111111111111111111111111112',
  IBRLC: '7wxyV4i7iZvayjGN9bXkgJMRnPcnwWnQTPtd9KWjN3vM'
} as const;

export const TOKEN_DECIMALS = {
  [KNOWN_TOKENS.USDC]: 6,
  [KNOWN_TOKENS.SOL]: 9,
  [KNOWN_TOKENS.IBRLC]: 9
} as const;

export const KNOWN_PROGRAMS = {
  TOKEN_PROGRAM: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  SYSTEM_PROGRAM: '11111111111111111111111111111111',
  ASSOCIATED_TOKEN_PROGRAM: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
} as const;

export const BURN_ADDRESSES = [
  '1111111111111111111111111111111111111111',
  'deaddeaddeaddeaddeaddeaddeaddeaddeaddead'
] as const;

export const ANALYSIS_CONFIG = {
  DUST_THRESHOLD: 0.001,
  LARGE_TX_MULTIPLIER: 2,
  PATTERN_THRESHOLD: 1.5,
  MAX_BATCH_SIZE: 20,
  CACHE_DURATION: {
    TOKEN_INFO: 300, // 5 minutes
    PRICE: 5,       // 5 seconds
    MARKET: 60      // 1 minute
  }
};

export function getHeliusUrl(): string {
  if (!API_CONFIG.HELIUS.API_KEY) {
    throw new Error('HELIUS_API_KEY is not configured');
  }
  return `${API_CONFIG.HELIUS.BASE_URL}/?api-key=${API_CONFIG.HELIUS.API_KEY}`;
}

export function getTokenDecimals(mint: string): number {
  return TOKEN_DECIMALS[mint as keyof typeof TOKEN_DECIMALS] || 9;
} 