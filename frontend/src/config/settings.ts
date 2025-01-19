// Simple function to get environment variables with defaults
const getEnvVar = (key: string, defaultValue: string = '') => {
    if (typeof window === 'undefined') {
      return process.env[key] || defaultValue;
    }
    return (window as any)?.__ENV?.[key] || process.env[key] || defaultValue;
  };
  
  export const CONFIG = {
    SOLANA: {
      NETWORK: getEnvVar('NEXT_PUBLIC_SOLANA_NETWORK', 'mainnet-beta'),
      RPC_URL: getEnvVar('NEXT_PUBLIC_RPC_URL', 'https://api.mainnet-beta.solana.com'),
      PUBLIC_KEY: getEnvVar('NEXT_PUBLIC_PUBLIC_KEY', ''),
      TOKEN_SETTINGS: {
        NAME: 'JENNA',
        SYMBOL: 'JENNA',
        DECIMALS: 9,
        SUPPLY: 100000000,
        ADDRESS: '8hVzPgFopqEQmNNoghr5WbPY1LEjW8GzgbLRwuwHpump'
      }
    },
  
    AI: {
      GROQ: {
        API_KEY: getEnvVar('NEXT_PUBLIC_GROQ_API_KEY', ''),
        MODEL: getEnvVar('NEXT_PUBLIC_GROQ_MODEL', 'mixtral-8x7b-32768'),
        MAX_TOKENS: parseInt(getEnvVar('NEXT_PUBLIC_GROQ_MAX_TOKENS', '1000')),
        DEFAULT_TEMPERATURE: parseFloat(getEnvVar('NEXT_PUBLIC_GROQ_TEMPERATURE', '0.7')),
        MAX_RETRIES: parseInt(getEnvVar('NEXT_PUBLIC_GROQ_MAX_RETRIES', '3')),
        RETRY_DELAY: parseInt(getEnvVar('NEXT_PUBLIC_GROQ_RETRY_DELAY', '1000'))
      }
    },
  
    AUTOMATION: {
      CONTENT_GENERATION_INTERVAL: 120000,  // 2 min
      MARKET_MONITORING_INTERVAL: 30000,    // 30 sec
      COMMUNITY_ENGAGEMENT_INTERVAL: 180000, // 3 min
      TWEET_INTERVAL: 300000                // 5 min
    }
  };
  
  // Export individual sections
  export const {
    SOLANA,
    AI,
    AUTOMATION
  } = CONFIG;