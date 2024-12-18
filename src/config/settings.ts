// src/config/settings.ts

import { PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
    'SOLANA_PRIVATE_KEY',
    'GROQ_API_KEY',
    'TWITTER_API_KEY',
    'DISCORD_TOKEN'
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

export interface DiscordConfig {
    token: string;
    allowedChannels: string[];
}

export const CONFIG = {
    // Blockchain Settings
    SOLANA: {
        RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
        PRIVATE_KEY: process.env.SOLANA_PRIVATE_KEY!,
        NETWORK: 'mainnet-beta' as const,
        TOKEN_SETTINGS: {
            NAME: 'MEME_AGENT',
            SYMBOL: 'MEME',
            DECIMALS: 9,
            INITIAL_SUPPLY: 1_000_000_000,
            METADATA: {
                name: 'Meme Agent Token',
                symbol: 'MEME',
                description: 'AI-powered meme coin influencer agent token',
                image: 'https://your-token-image.com/meme.png',
                external_url: 'https://your-website.com',
                attributes: []
            }
        },
        TRADING: {
            DEFAULT_SLIPPAGE_BPS: 300, // 3%
            MIN_SOL_BALANCE: 0.05, // Minimum SOL to keep for transactions
            MAX_TRANSACTION_RETRIES: 3
        }
    },

    // AI Settings
    AI: {
        GROQ: {
            API_KEY: process.env.GROQ_API_KEY!,
            MODEL: 'mixtral-8x7b-32768',
            DEFAULT_TEMPERATURE: 0.9,
            MAX_TOKENS: 150,
            SYSTEM_PROMPTS: {
                MEME_GENERATION: `You are a meme coin influencer AI agent. Your token is called $MEME.
                                Be engaging, funny, and create viral content. Keep responses under 280 characters
                                for Twitter compatibility. Use emojis and relevant hashtags.`,
                SENTIMENT_ANALYSIS: 'Analyze the sentiment of the following text and respond with only positive, negative, or neutral.',
                TRADING_ANALYSIS: 'Analyze the trading opportunity and provide a clear recommendation.'
            }
        }
    },

    // Social Media Settings
    SOCIAL: {
        TWITTER: {
            tokens: {
                appKey: 'your-app-key',
                appSecret: 'your-app-secret',
                accessToken: 'your-access-token',
                accessSecret: 'your-access-secret'
            },
            API_KEY: process.env.TWITTER_API_KEY!,
            USERNAME: process.env.TWITTER_USERNAME || '',
            POSTING_INTERVAL: 3600000, // 1 hour in milliseconds
            MAX_TWEET_LENGTH: 280,
            HASHTAGS: ['#Solana', '#Crypto', '#Memecoins', '#Web3'],
            REPLY_PROBABILITY: 0.8, // 80% chance to reply to mentions
            URL: "https://twitter.com/your_twitter_handle"
        },
        TELEGRAM: {
            URL: "https://t.me/your_telegram_channel"
        },
        DISCORD: {
            TOKEN: process.env.DISCORD_TOKEN!,
            GUILD_ID: 'your-guild-id',
            COMMAND_PREFIX: '!',
            ALLOWED_CHANNELS: (process.env.DISCORD_ALLOWED_CHANNELS ? process.env.DISCORD_ALLOWED_CHANNELS.split(',') : []) as string[],
            ADMIN_ROLES: [], // Add admin role IDs
            COOLDOWN: 60000 // 1 minute cooldown between commands
        }
    },

    // Market Analysis Settings
    MARKET: {
        UPDATE_INTERVAL: 300000, // 5 minutes
        PRICE_CHANGE_THRESHOLD: 0.05, // 5% price change trigger
        VOLUME_CHANGE_THRESHOLD: 0.1, // 10% volume change trigger
        DATA_SOURCES: {
            DEX_SCREENER: 'https://api.dexscreener.com/latest/dex/tokens/',
            BIRDEYE: 'https://api.birdeye.so/v1/token/'
        }
    },

    // Development Settings
    DEV: {
        IS_PRODUCTION: process.env.NODE_ENV === 'production',
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
        ENABLE_DEBUG: process.env.ENABLE_DEBUG === 'true',
        ERROR_REPORTING: {
            ENABLED: true,
            WEBHOOK_URL: process.env.ERROR_WEBHOOK_URL
        }
    },

    WEBSITE_URL: "https://yourwebsite.com",

    PUMP: {
        INITIAL_LIQUIDITY: 1000,
        SLIPPAGE_BPS: 50,
        PRIORITY_FEE: 0.001
    }
} as const;

// Utility functions for configuration
export const getConfig = () => CONFIG;

export const getSolanaConfig = () => CONFIG.SOLANA;

export const getAIConfig = () => CONFIG.AI;

export const getSocialConfig = () => CONFIG.SOCIAL;

export const getMarketConfig = () => CONFIG.MARKET;

export const isProduction = () => CONFIG.DEV.IS_PRODUCTION;

// Type definitions
export type Config = typeof CONFIG;
export type SolanaConfig = typeof CONFIG.SOLANA;
export type AIConfig = typeof CONFIG.AI;
export type SocialConfig = typeof CONFIG.SOCIAL;
export type MarketConfig = typeof CONFIG.MARKET;

// Validation helper
export const validateConfig = () => {
    // Add any additional validation logic here
    try {
        new PublicKey(CONFIG.SOLANA.PRIVATE_KEY);
    } catch (error) {
        throw new Error('Invalid Solana private key in configuration');
    }

    if (CONFIG.SOLANA.TOKEN_SETTINGS.INITIAL_SUPPLY <= 0) {
        throw new Error('Initial token supply must be greater than 0');
    }

    return true;
};

// Initialize configuration
validateConfig();

export default CONFIG;