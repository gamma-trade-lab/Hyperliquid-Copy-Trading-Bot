import dotenv from 'dotenv';
dotenv.config();
const config = {
    env: process.env.NODE_ENV || 'development',
    database: {
        postgres: {
            host: process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.POSTGRES_PORT || '5432'),
            username: process.env.POSTGRES_USER || 'postgres',
            password: process.env.POSTGRES_PASSWORD || 'postgres',
            database: process.env.POSTGRES_DB || 'swarm_db'
        },
        mongodb: {
            uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/swarm_db'
        },
        redis: {
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        }
    },
    server: {
        port: parseInt(process.env.APP_PORT || '3000'),
        host: process.env.APP_HOST || 'localhost'
    },
    security: {
        jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'development' ? 'dev-secret-key' : ''),
        jwtExpiration: process.env.JWT_EXPIRATION || '24h'
    },
    agent: {
        defaultTimeout: parseInt(process.env.DEFAULT_AGENT_TIMEOUT || '30000'),
        maxConcurrentTasks: parseInt(process.env.MAX_CONCURRENT_TASKS || '5'),
        taskQueueSize: parseInt(process.env.TASK_QUEUE_SIZE || '100')
    },
    lock: {
        ttl: parseInt(process.env.LOCK_TTL || '30'),
        retryDelay: parseInt(process.env.LOCK_RETRY_DELAY || '1000'),
        maxRetries: parseInt(process.env.MAX_LOCK_RETRIES || '5')
    },
    cache: {
        ttl: parseInt(process.env.CACHE_TTL || '3600'),
        checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD || '600')
    },
    event: {
        retentionPeriod: parseInt(process.env.EVENT_RETENTION_PERIOD || '86400'),
        maxBatchSize: parseInt(process.env.MAX_EVENT_BATCH_SIZE || '1000')
    },
    solana: {
        rpcEndpoint: process.env.SOLANA_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com',
        traderAddress: process.env.SOLANA_TRADER_ADDRESS || '',
        commitment: (process.env.SOLANA_COMMITMENT || 'confirmed')
    },
    helius: {
        apiKey: process.env.HELIUS_API_KEY || '',
        baseUrl: process.env.HELIUS_BASE_URL || 'https://api.helius.xyz'
    }
};
export default config;
