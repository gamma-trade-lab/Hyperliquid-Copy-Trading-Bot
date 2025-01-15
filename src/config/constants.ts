export enum NetworkType {
    MAINNET = 'mainnet-beta',
    DEVNET = 'devnet',
    TESTNET = 'testnet'
}

export enum AIModel {
    MIXTRAL = 'mixtral-8x7b-32768',
    LLAMA = 'llama-2-70b-4096',
    MPT = 'mpt-30b-2048'
}

export enum SocialPlatform {
    TWITTER = 'twitter',
    DISCORD = 'discord',
    TELEGRAM = 'telegram'
}

export enum TransactionType {
    SWAP = 'swap',
    STAKE = 'stake',
    TRANSFER = 'transfer',
    LIQUIDITY = 'liquidity'
}

export enum MarketAction {
    BUY = 'buy',
    SELL = 'sell',
    HOLD = 'hold',
    PRICE_UPDATE = 'price_update',
    VOLUME_UPDATE = 'volume_update',
    MARKET_ALERT = 'market_alert',
    TREND_UPDATE = 'trend_update',
    UPDATE = "UPDATE",
    ALERT = "ALERT"
}

export enum MarketCondition {
    BULLISH = 'bullish',
    BEARISH = 'bearish',
    NEUTRAL = 'neutral'
}

export enum SentimentLevel {
    POSITIVE = 'positive',
    NEGATIVE = 'negative',
    NEUTRAL = 'neutral'
}

export const ERROR_CODES = {
    INSUFFICIENT_FUNDS: 'E001',
    INVALID_TRANSACTION: 'E002',
    API_ERROR: 'E003',
    RATE_LIMIT: 'E004',
    SLIPPAGE_TOO_HIGH: 'E005'
} as const;

export const NETWORK_ENDPOINTS = {
    [NetworkType.MAINNET]: {
        default: 'https://api.mainnet-beta.solana.com',
        helius: process.env.HELIUS_RPC_URL
    },
    [NetworkType.DEVNET]: {
        default: 'https://api.devnet.solana.com',
        helius: process.env.HELIUS_DEVNET_RPC_URL
    }
} as const;

export const TIME_CONSTANTS = {
    BLOCK_TIME: 400, // milliseconds
    MAX_TRANSACTION_TIMEOUT: 30000, // 30 seconds
    RATE_LIMIT_WINDOW: 60000, // 1 minute
    CACHE_DURATION: 300000 // 5 minutes
} as const;

export const PROTOCOL_ADDRESSES = {
    JUPITER_PROGRAM_ID: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
    METEORA_PROGRAM_ID: 'M3TPE3M5RyQZVBcgwg8aJR24wkp5e1gEjfN9WL6ywSS',
    TOKEN_PROGRAM_ID: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
} as const;

export const DEFAULT_TRANSACTION_OPTIONS = {
    maxRetries: 3,
    minContextSlot: 0,
    skipPreflight: false,
    maxSignatureFee: 5000 // lamports
} as const;

export const DEFAULT_OPTIONS = {
  maxRetries: 3,
  minContextSlot: 0,
  skipPreflight: false,
  maxSignatureFee: 5000, // lamports
  SLIPPAGE_BPS: 50 // basis points
} as const;

export const JUP_API = "https://api.jup.ag/v1";
export const JUP_REFERRAL_ADDRESS = "HAiQr2kZNUer8vWGS9KPFqcAFta5wCKsXj4DMohPzu8H";

export const AUTOMATION = {

    CONTENT_GENERATION_INTERVAL: 60000,

    MARKET_MONITORING_INTERVAL: 60000,

    COMMUNITY_ENGAGEMENT_INTERVAL: 60000

  } as const ;

export const CONFIG = {
  AI: {
    GROQ: {
      API_KEY: process.env.GROQ_API_KEY || '',
      MODEL: 'mixtral-8x7b-32768',
      MAX_TOKENS: 4096,
      DEFAULT_TEMPERATURE: 0.7,
      THREAD_ID: 'jenna_v1', // Add THREAD_ID property
      SYSTEM_PROMPTS: {
        MARKET_ANALYSIS: 'Analyze the following market data and provide insights:',
        TRADE_DECISION: 'Based on the market analysis, recommend trading actions:',
        CONTENT_GENERATION: 'Generate market commentary based on the following data:',
        MEME_GENERATION: 'Create engaging crypto meme content based on market data:'
      }
    }
  },
};
