// src/config/settings.ts
import * as dotenv from 'dotenv';

//import { validateConfig } from '../utils/config-validator';

dotenv.config();

/**
 * Get required environment variable with optional default value
 */
function getRequiredEnvVar(key, defaultValue) {
    const value = process.env[key];
    if (!value) {
        if (defaultValue !== undefined) {
            return defaultValue;
        }
        throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
}

export const CONFIG = {
    SOLANA: {
        NETWORK: process.env.SOLANA_NETWORK,
        RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
        PRIVATE_KEY: process.env.SOLANA_PRIVATE_KEY || '',
        PUBLIC_KEY: process.env.SOLANA_PUBLIC_KEY || '',
        helius: {
            API_KEY: process.env.HELIUS_API_KEY || '',
            BASE_URL: process.env.HELIUS_BASE_URL || 'https://api.helius.xyz',
            ENDPOINTS: {
                TRANSACTIONS: '/v0/transactions',
                PARSED_TX: '/v0/parsed-transactions'
            }
        },
        TOKEN_SETTINGS: {
            NAME: "Solana", // Add this
            SYMBOL: "SOL", // Add this
            DECIMALS: 9, // Add this
            PRICE_UPDATE_INTERVAL: parseInt(process.env.PRICE_UPDATE_INTERVAL || '300000', 10),
            MARKET_UPDATE_INTERVAL: parseInt(process.env.MARKET_UPDATE_INTERVAL || '600000', 10),
            DATA_PROVIDERS: {
                BIRDEYE: {
                    API_KEY: process.env.BIRDEYE_API_KEY || '',
                    BASE_URL: 'https://public-api.birdeye.so',
                    MAX_RETRIES: parseInt(process.env.BIRDEYE_MAX_RETRIES || '3', 10),
                    RETRY_DELAY: parseInt(process.env.BIRDEYE_RETRY_DELAY || '2000', 10),
                    ENDPOINTS: {
                        TOKEN_SECURITY: '/defi/token_security?address=',
                        TOKEN_PRICE: '/defi/price?address=',
                        TOKEN_TRADE_DATA: '/defi/v3/token/trade-data/single?address='
                    }
                },
                JUPITER: {
                    BASE_URL: 'https://price.jup.ag/v4',
                    ENDPOINTS: {
                        PRICE: '/price',
                        QUOTE: '/quote'
                    }
                }
            }
        },
        TRADING: {
            ENABLED: process.env.TRADING_ENABLED === 'true',
            BASE_AMOUNT: parseFloat(process.env.TRADING_BASE_AMOUNT || '0.1'),
            MIN_CONFIDENCE: parseFloat(process.env.TRADING_MIN_CONFIDENCE || '0.7'),
            SLIPPAGE: parseFloat(process.env.TRADING_SLIPPAGE || '0.01'),
            MAX_PRICE_IMPACT: parseFloat(process.env.MAX_PRICE_IMPACT || '3.0'),
            MIN_LIQUIDITY_USD: parseFloat(process.env.MIN_LIQUIDITY_USD || '10000'),
            AUTO_TRADE: {
                ENABLED: process.env.AUTO_TRADE_ENABLED === 'true',
                MAX_TRADES_PER_DAY: parseInt(process.env.MAX_TRADES_PER_DAY || '10', 10),
                MIN_PROFIT_THRESHOLD: parseFloat(process.env.MIN_PROFIT_THRESHOLD || '1.5')
            }
        }
    },
    TOKENS: {
        SUPPORTED_TOKENS: {
            SOL: {
                address: 'So11111111111111111111111111111111111111112',
                name: 'Solana',
                symbol: 'SOL',
                decimals: 9
            },
            USDC: {
                address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                name: 'USD Coin',
                symbol: 'USDC',
                decimals: 6
            }
        },
        SETTINGS: {
            PRICE_UPDATE_INTERVAL: parseInt(process.env.PRICE_UPDATE_INTERVAL || '300000', 10),
            MARKET_UPDATE_INTERVAL: parseInt(process.env.MARKET_UPDATE_INTERVAL || '600000', 10)
        }
    },
    // Add security configuration
    security: {
        jwtSecret: process.env.JWT_SECRET || 'your-default-secret-key',
        jwtExpiration: process.env.JWT_EXPIRATION || '24h'
    },
    AI: {
        GROQ: {
            API_KEY: process.env.GROQ_API_KEY || '',
            MODEL: 'mixtral-8x7b-32768',
            MAX_TOKENS: parseInt(process.env.GROQ_MAX_TOKENS || '1000', 10),
            DEFAULT_TEMPERATURE: parseFloat(process.env.GROQ_DEFAULT_TEMPERATURE || '0.7'),
            SYSTEM_PROMPTS: {
                MARKET_ANALYSIS: 'Analyze the following market data and provide insights:',
                TRADE_DECISION: 'Based on the market analysis, recommend trading actions:',
                CONTENT_GENERATION: 'Generate market commentary based on the following data:',
                MEME_GENERATION: 'Create engaging crypto meme content based on market data:'
            }
        }
    },
    SOCIAL: {
        TWITTER: {
            tokens: {
                appKey: process.env.TWITTER_API_KEY || '',
                appSecret: process.env.TWITTER_API_SECRET || '',
                accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
                accessSecret: process.env.TWITTER_ACCESS_SECRET || '',
                bearerToken: process.env.TWITTER_BEARER_TOKEN || ''
            },
            POSTING: {
                MIN_INTERVAL: parseInt(process.env.TWEET_MIN_INTERVAL || '300000', 10),
                MAX_DAILY_TWEETS: parseInt(process.env.MAX_DAILY_TWEETS || '48', 10),
                PRICE_CHANGE_THRESHOLD: parseFloat(process.env.TWEET_PRICE_CHANGE_THRESHOLD || '0.05')
            }
        }
    },
    AUTOMATION: {
        ENABLED: process.env.AUTOMATION_ENABLED === 'true',
        CONTENT_GENERATION_INTERVAL: parseInt(getRequiredEnvVar('CONTENT_GENERATION_INTERVAL', '120000')),
        MARKET_MONITORING_INTERVAL: parseInt(getRequiredEnvVar('MARKET_MONITORING_INTERVAL', '30000')),
        COMMUNITY_ENGAGEMENT_INTERVAL: parseInt(getRequiredEnvVar('COMMUNITY_ENGAGEMENT_INTERVAL', '300000'))
    },
    MARKET: {
        ANALYSIS: {
            PRICE_CHANGE_THRESHOLDS: {
                SIGNIFICANT: parseFloat(process.env.SIGNIFICANT_PRICE_CHANGE || '0.05'),
                MAJOR: parseFloat(process.env.MAJOR_PRICE_CHANGE || '0.10'),
                EXTREME: parseFloat(process.env.EXTREME_PRICE_CHANGE || '0.20')
            },
            VOLUME_THRESHOLDS: {
                LOW: parseFloat(process.env.LOW_VOLUME_THRESHOLD || '1000'),
                MEDIUM: parseFloat(process.env.MEDIUM_VOLUME_THRESHOLD || '10000'),
                HIGH: parseFloat(process.env.HIGH_VOLUME_THRESHOLD || '100000')
            },
            UPDATE_INTERVALS: {
                QUICK: 30000,
                NORMAL: 300000,
                DETAILED: 3600000
            }
        }
    },
    CACHE: {
        REDIS: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0', 10),
            keyPrefix: 'meme-agent:'
        },
        TTL: {
            PRICE: 60,
            MARKET_DATA: 300,
            SECURITY_DATA: 3600,
            HOLDER_DATA: 3600
        }
    },
    SYSTEM_PROMPTS: {
        MARKET_ANALYSIS: {
            BASIC: `Analyze the following market data:
- Price: {{price}}
- Volume: {{volume}}
- Change: {{change}}
Provide key insights and trends.`,
            TECHNICAL: `Perform technical analysis:
- Support: {{support}}
- Resistance: {{resistance}}
- Indicators: {{indicators}}
Identify trading opportunities.`,
            SENTIMENT: `Evaluate market sentiment:
- Social signals: {{social}}
- News impact: {{news}}
- Trader sentiment: {{sentiment}}
Assess overall market mood.`
        },
        TRADE_DECISION: {
            ENTRY: `Evaluate entry conditions:
- Price level: {{price}}
- Volume profile: {{volume}}
- Risk/reward: {{risk}}
Recommend entry strategy.`,
            EXIT: `Determine exit points:
- Take profit: {{tp}}
- Stop loss: {{sl}}
- Position size: {{size}}
Suggest exit strategy.`,
            RISK: `Assess risk factors:
- Market risk: {{market}}
- Liquidity risk: {{liquidity}}
- Volatility risk: {{volatility}}
Provide risk management advice.`
        },
        CONTENT_GENERATION: {
            TWEET: `Create market update tweet:
- Token: {{token}}
- Metrics: {{metrics}}
- Highlight: {{highlight}}
Generate viral content.`,
            REPORT: `Generate market report:
- Overview: {{overview}}
- Analysis: {{analysis}}
- Outlook: {{outlook}}
Provide comprehensive update.`,
            ALERT: `Format price alert:
- Symbol: {{symbol}}
- Event: {{event}}
- Action: {{action}}
Create urgent notification.`
        },
        MEME_GENERATION: {
            TEMPLATE: `Design meme template:
- Theme: {{theme}}
- Format: {{format}}
- Elements: {{elements}}
Create engaging visual.`,
            STYLE: `Define meme style:
- Tone: {{tone}}
- Humor: {{humor}}
- References: {{references}}
Establish content style.`,
            TONE: `Set content tone:
- Audience: {{audience}}
- Mood: {{mood}}
- Impact: {{impact}}
Guide content creation.`
        }
    }
};

// Validate configuration
validateConfig(CONFIG);

export default CONFIG;
