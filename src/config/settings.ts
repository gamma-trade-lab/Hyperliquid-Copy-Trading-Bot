// src/config/settings.ts

import { PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import { NetworkType } from './constants';
import bs58 from 'bs58';
import { validateSolanaConfig } from '../utils/solana-validator';

// Load environment variables
dotenv.config();
console.log('Loaded .env file from:', process.cwd() + '/.env');

// Validate required environment variables
const requiredEnvVars = [
    'SOLANA_PRIVATE_KEY',
    'GROQ_API_KEY'
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

function getRequiredEnvVar(key: string, defaultValue?: string): string {
    const value = process.env[key];
    if (!value && defaultValue === undefined) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value || defaultValue || '';
}

export const CONFIG = {
    // Blockchain Settings
    SOLANA: {
        NETWORK: getRequiredEnvVar('NETWORK_TYPE', 'devnet') as NetworkType,
        RPC_URL: getRequiredEnvVar('RPC_ENDPOINT', 'https://api.devnet.solana.com'),
        PRIVATE_KEY: getRequiredEnvVar('SOLANA_PRIVATE_KEY'),
        PUBLIC_KEY: getRequiredEnvVar('SOLANA_PUBLIC_KEY'),
        TOKEN_SETTINGS: {
            NAME: getRequiredEnvVar('TOKEN_NAME', 'Meme Token'),
            SYMBOL: getRequiredEnvVar('TOKEN_SYMBOL', 'MEME'),
            DECIMALS: parseInt(getRequiredEnvVar('TOKEN_DECIMALS', '9')),
            METADATA: JSON.parse(getRequiredEnvVar('TOKEN_METADATA', '{"description":"Meme Token for Testing"}'))
        },
        TRADING: {
            BASE_AMOUNT: parseFloat(getRequiredEnvVar('TRADING_BASE_AMOUNT', '0.1')),
            MIN_CONFIDENCE: parseFloat(getRequiredEnvVar('TRADING_MIN_CONFIDENCE', '0.7')),
            SLIPPAGE: parseFloat(getRequiredEnvVar('TRADING_SLIPPAGE', '0.01'))
        }
    },

    // AI Settings
    AI: {
        GROQ: {
            API_KEY: process.env.GROQ_API_KEY || '',
            MODEL: process.env.GROQ_MODEL || 'default-model',
            MAX_TOKENS: parseInt(process.env.GROQ_MAX_TOKENS || '1000', 10),
            DEFAULT_TEMPERATURE: parseFloat(process.env.GROQ_DEFAULT_TEMPERATURE || '0.7'),
            SYSTEM_PROMPTS: {
                MEME_GENERATION: 'Generate a meme based on the following prompt:'
            }
        }
    },

    // Social Media Settings
    SOCIAL: {
        TWITTER: {
            tokens: {
                appKey: process.env.TWITTER_API_KEY || '',
                appSecret: process.env.TWITTER_API_SECRET || '',
                accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
                accessSecret: process.env.TWITTER_ACCESS_SECRET || ''
            },
            username: getRequiredEnvVar('TWITTER_USERNAME'),
            password: getRequiredEnvVar('TWITTER_PASSWORD'),
            email: getRequiredEnvVar('TWITTER_EMAIL')
        },
        DISCORD: {
            TOKEN: process.env.DISCORD_TOKEN || '',
            GUILD_ID: process.env.DISCORD_GUILD_ID || '',
            COMMAND_PREFIX: process.env.DISCORD_COMMAND_PREFIX || '!'
        }
    },

    AUTOMATION: {
        CONTENT_GENERATION_INTERVAL: parseInt(process.env.CONTENT_GENERATION_INTERVAL || '120000'), // 2 minutes default
        MARKET_MONITORING_INTERVAL: parseInt(process.env.MARKET_MONITORING_INTERVAL || '30000'),    // 30 seconds default
        COMMUNITY_ENGAGEMENT_INTERVAL: parseInt(process.env.COMMUNITY_ENGAGEMENT_INTERVAL || '180000'), // 3 minutes default
        TWEET_INTERVAL: parseInt(process.env.TWEET_INTERVAL || '300000') // 5 minutes default
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
            ENABLED: process.env.ENABLE_ERROR_REPORTING === 'true',
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
function isValidPrivateKey(key: string): boolean {
    try {
        // Check if the key is a hex string of the correct length
        if (/^[0-9a-fA-F]{128}$/.test(key)) return true;
        
        // If it's an array string, parse it and check length
        if (key.startsWith('[') && key.endsWith(']')) {
            const numbers = key
                .slice(1, -1)
                .split(',')
                .map(n => parseInt(n.trim()));
            return numbers.length === 64 && numbers.every(n => n >= 0 && n <= 255);
        }
        
        return false;
    } catch {
        return false;
    }
}

// Initialize configuration
validateConfig();
validateSolanaConfig({
  ...CONFIG.SOLANA,
  PUBLIC_KEY: CONFIG.SOLANA.PUBLIC_KEY,
});

export default CONFIG;

function validateConfig() {
    // Validate Solana private key
    if (!isValidPrivateKey(CONFIG.SOLANA.PRIVATE_KEY)) {
        throw new Error('Invalid Solana private key format.');
    }

    // Validate Solana public key
    try {
        new PublicKey(CONFIG.SOLANA.PUBLIC_KEY);
    } catch (error) {
        throw new Error('Invalid Solana public key format.');
    }

    // Validate network type
    if (!Object.values(NetworkType).includes(CONFIG.SOLANA.NETWORK as NetworkType)) {
        throw new Error('Invalid Solana network type.');
    }

    // Validate token decimals
    if (isNaN(CONFIG.SOLANA.TOKEN_SETTINGS.DECIMALS) || CONFIG.SOLANA.TOKEN_SETTINGS.DECIMALS < 0) {
        throw new Error('Invalid token decimals.');
    }

    // Validate trading settings
    if (isNaN(CONFIG.SOLANA.TRADING.BASE_AMOUNT) || CONFIG.SOLANA.TRADING.BASE_AMOUNT <= 0) {
        throw new Error('Invalid trading base amount.');
    }
    if (isNaN(CONFIG.SOLANA.TRADING.MIN_CONFIDENCE) || CONFIG.SOLANA.TRADING.MIN_CONFIDENCE < 0 || CONFIG.SOLANA.TRADING.MIN_CONFIDENCE > 1) {
        throw new Error('Invalid trading minimum confidence.');
    }
    if (isNaN(CONFIG.SOLANA.TRADING.SLIPPAGE) || CONFIG.SOLANA.TRADING.SLIPPAGE < 0 || CONFIG.SOLANA.TRADING.SLIPPAGE > 1) {
        throw new Error('Invalid trading slippage.');
    }

    // Validate AI settings
    if (isNaN(CONFIG.AI.GROQ.MAX_TOKENS) || CONFIG.AI.GROQ.MAX_TOKENS <= 0) {
        throw new Error('Invalid AI max tokens.');
    }
    if (isNaN(CONFIG.AI.GROQ.DEFAULT_TEMPERATURE) || CONFIG.AI.GROQ.DEFAULT_TEMPERATURE < 0 || CONFIG.AI.GROQ.DEFAULT_TEMPERATURE > 1) {
        throw new Error('Invalid AI default temperature.');
    }

    // Validate Twitter credentials
    const { username, password, email } = CONFIG.SOCIAL.TWITTER;
    if (!username || !password || !email) {
        throw new Error('Missing required Twitter credentials');
    }
    // Discord is optional, no validation needed

    // Validate automation intervals
    if (isNaN(CONFIG.AUTOMATION.CONTENT_GENERATION_INTERVAL) || CONFIG.AUTOMATION.CONTENT_GENERATION_INTERVAL <= 0) {
        throw new Error('Invalid content generation interval.');
    }
    if (isNaN(CONFIG.AUTOMATION.MARKET_MONITORING_INTERVAL) || CONFIG.AUTOMATION.MARKET_MONITORING_INTERVAL <= 0) {
        throw new Error('Invalid market monitoring interval.');
    }
    if (isNaN(CONFIG.AUTOMATION.COMMUNITY_ENGAGEMENT_INTERVAL) || CONFIG.AUTOMATION.COMMUNITY_ENGAGEMENT_INTERVAL <= 0) {
        throw new Error('Invalid community engagement interval.');
    }

    // Validate market settings
    if (isNaN(CONFIG.MARKET.UPDATE_INTERVAL) || CONFIG.MARKET.UPDATE_INTERVAL <= 0) {
        throw new Error('Invalid market update interval.');
    }
    if (isNaN(CONFIG.MARKET.PRICE_CHANGE_THRESHOLD) || CONFIG.MARKET.PRICE_CHANGE_THRESHOLD < 0 || CONFIG.MARKET.PRICE_CHANGE_THRESHOLD > 1) {
        throw new Error('Invalid market price change threshold.');
    }
    if (isNaN(CONFIG.MARKET.VOLUME_CHANGE_THRESHOLD) || CONFIG.MARKET.VOLUME_CHANGE_THRESHOLD < 0 || CONFIG.MARKET.VOLUME_CHANGE_THRESHOLD > 1) {
        throw new Error('Invalid market volume change threshold.');
    }

    // Validate development settings
    if (typeof CONFIG.DEV.IS_PRODUCTION !== 'boolean') {
        throw new Error('Invalid development production flag.');
    }
    if (!['info', 'debug', 'warn', 'error'].includes(CONFIG.DEV.LOG_LEVEL)) {
        throw new Error('Invalid log level.');
    }
    if (typeof CONFIG.DEV.ENABLE_DEBUG !== 'boolean') {
        throw new Error('Invalid debug flag.');
    }
    if (CONFIG.DEV.ERROR_REPORTING.ENABLED) {
        if (!CONFIG.DEV.ERROR_REPORTING.WEBHOOK_URL) {
            console.warn('Warning: Error reporting is enabled but no webhook URL is provided. Disabling error reporting.');
            (CONFIG.DEV.ERROR_REPORTING as any).ENABLED = false;
        }
    }
}
