// Mock settings for tests
export const CONFIG = {
  SOLANA: {
    NETWORK: 'devnet',
    RPC_URL: 'https://api.devnet.solana.com',
    PRIVATE_KEY: 'a'.repeat(128),
    PUBLIC_KEY: 'DummyPublicKeyForTesting'.repeat(2),
    TOKEN_SETTINGS: {
      NAME: 'Test Token',
      SYMBOL: 'TEST',
      DECIMALS: 9,
      METADATA: { description: 'Test Token for Testing' }
    },
    TRADING: {
      BASE_AMOUNT: 0.1,
      MIN_CONFIDENCE: 0.7,
      SLIPPAGE: 0.01
    }
  },
  AI: {
    GROQ: {
      API_KEY: 'test-groq-key',
      MODEL: 'test-model',
      MAX_TOKENS: 1000,
      DEFAULT_TEMPERATURE: 0.7,
      SYSTEM_PROMPTS: {
        MEME_GENERATION: 'Generate a meme based on the following prompt:'
      }
    }
  },
  SOCIAL: {
    TWITTER: {
      tokens: {
        appKey: 'test-app-key',
        appSecret: 'test-app-secret',
        accessToken: 'test-access-token',
        accessSecret: 'test-access-secret'
      },
      USERNAME: 'test-username'
    },
    DISCORD: {
      TOKEN: 'test-discord-token',
      GUILD_ID: 'test-guild-id',
      COMMAND_PREFIX: '!'
    }
  },
  AUTOMATION: {
    CONTENT_GENERATION_INTERVAL: 300000,
    MARKET_MONITORING_INTERVAL: 300000,
    COMMUNITY_ENGAGEMENT_INTERVAL: 300000
  },
  MARKET: {
    UPDATE_INTERVAL: 300000,
    PRICE_CHANGE_THRESHOLD: 0.05,
    VOLUME_CHANGE_THRESHOLD: 0.1,
    DATA_SOURCES: {
      DEX_SCREENER: 'https://api.dexscreener.com/latest/dex/tokens/',
      BIRDEYE: 'https://api.birdeye.so/v1/token/'
    }
  },
  DEV: {
    IS_PRODUCTION: false,
    LOG_LEVEL: 'info',
    ENABLE_DEBUG: true,
    ERROR_REPORTING: {
      ENABLED: false,
      WEBHOOK_URL: null
    }
  },
  WEBSITE_URL: "https://test.com",
  PUMP: {
    INITIAL_LIQUIDITY: 1000,
    SLIPPAGE_BPS: 50,
    PRIORITY_FEE: 0.001
  }
};

export const getConfig = () => CONFIG;
export const getSolanaConfig = () => CONFIG.SOLANA;
export const getAIConfig = () => CONFIG.AI;
export const getSocialConfig = () => CONFIG.SOCIAL;
export const getMarketConfig = () => CONFIG.MARKET;
export const isProduction = () => CONFIG.DEV.IS_PRODUCTION;

export default CONFIG;
