import Redis from 'ioredis';
import { Logger } from '../../utils/logger.js';
export class RedisService {
    static createInstance(arg0) {
        throw new Error('Method not implemented.');
    }
    static instance;
    _client;
    // Public getter for client to allow controlled access
    get client() {
        return this._client;
    }
    logger;
    isInitialized = false;
    lastError;
    commandCount = 0;
    failedCommandCount = 0;
    constructor(config) {
        this.logger = new Logger('redis');
        this._client = new Redis({
            host: config.host,
            port: config.port,
            password: config.password,
            db: config.db || 0,
            keyPrefix: config.keyPrefix || 'meme-agent:',
            retryStrategy: (times) => {
                if (config.retryStrategy) {
                    return config.retryStrategy(times);
                }
                const delay = Math.min(times * 100, 3000);
                this.logger.warn(`Redis connection retry ${times}, delay: ${delay}ms`);
                return delay;
            },
            reconnectOnError: (err) => {
                this.logger.error('Redis connection error', err);
                this.lastError = err;
                return true;
            }
        });
        this.setupEventHandlers();
    }
    static getInstance(config) {
        if (!RedisService.instance) {
            RedisService.instance = new RedisService(config);
        }
        return RedisService.instance;
    }
    setupEventHandlers() {
        this.client.on('connect', () => {
            this.logger.info('Redis client connected');
        });
        this.client.on('ready', () => {
            this.isInitialized = true;
            this.logger.info('Redis client ready');
        });
        this.client.on('error', (error) => {
            this.lastError = error;
            this.logger.error('Redis client error', error);
        });
        this.client.on('close', () => {
            this.logger.warn('Redis client connection closed');
        });
        this.client.on('reconnecting', () => {
            this.logger.info('Redis client reconnecting');
        });
        this.client.on('end', () => {
            this.isInitialized = false;
            this.logger.warn('Redis client connection ended');
        });
    }
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            await this.client.ping();
            this.isInitialized = true;
            this.logger.info('Redis service initialized successfully');
        }
        catch (error) {
            this.lastError = error;
            this.logger.error('Failed to initialize Redis service', error);
            throw error;
        }
    }
    async getHealth() {
        try {
            const info = await this.client.info();
            const memory = this.parseMemoryInfo(info);
            return {
                isConnected: this.client.status === 'ready',
                uptime: this.getUptime(info),
                memoryUsage: memory,
                commandStats: {
                    total: this.commandCount,
                    failedCount: this.failedCommandCount
                },
                lastError: this.lastError?.message
            };
        }
        catch (error) {
            this.logger.error('Failed to get Redis health info', error);
            throw error;
        }
    }
    parseMemoryInfo(info) {
        const used = this.parseInfoValue(info, 'used_memory_human');
        const peak = this.parseInfoValue(info, 'used_memory_peak_human');
        const frag = this.parseInfoValue(info, 'mem_fragmentation_ratio');
        return {
            used: this.parseMemoryValue(used),
            peak: this.parseMemoryValue(peak),
            fragmentation: Number(frag) || 0
        };
    }
    parseInfoValue(info, key) {
        const match = info.match(new RegExp(`${key}:(.+)`));
        return match ? match[1].trim() : '0';
    }
    parseMemoryValue(value) {
        const match = value.match(/(\d+(?:\.\d+)?)(K|M|G|T)?/i);
        if (!match)
            return 0;
        const [, num, unit] = match;
        const multipliers = {
            'K': 1024,
            'M': 1024 * 1024,
            'G': 1024 * 1024 * 1024,
            'T': 1024 * 1024 * 1024 * 1024
        };
        return Number(num) * (unit ? multipliers[unit.toUpperCase()] : 1);
    }
    getUptime(info) {
        const uptime = this.parseInfoValue(info, 'uptime_in_seconds');
        return parseInt(uptime) || 0;
    }
    // Cache operations with logging and error handling
    async get(key) {
        try {
            this.commandCount++;
            const value = await this.client.get(key);
            if (!value)
                return null;
            return JSON.parse(value);
        }
        catch (error) {
            this.failedCommandCount++;
            this.logger.error(`Failed to get key: ${key}`, error);
            throw error;
        }
    }
    async set(key, value, ttlSeconds) {
        try {
            this.commandCount++;
            const serialized = JSON.stringify(value);
            if (ttlSeconds) {
                await this.client.setex(key, ttlSeconds, serialized);
            }
            else {
                await this.client.set(key, serialized);
            }
        }
        catch (error) {
            this.failedCommandCount++;
            this.logger.error(`Failed to set key: ${key}`, error);
            throw error;
        }
    }
    async delete(key) {
        try {
            this.commandCount++;
            await this.client.del(key);
        }
        catch (error) {
            this.failedCommandCount++;
            this.logger.error(`Failed to delete key: ${key}`, error);
            throw error;
        }
    }
    async exists(key) {
        try {
            this.commandCount++;
            const result = await this.client.exists(key);
            return result === 1;
        }
        catch (error) {
            this.failedCommandCount++;
            this.logger.error(`Failed to check key existence: ${key}`, error);
            throw error;
        }
    }
    // Pub/Sub operations
    async publish(channel, message) {
        try {
            this.commandCount++;
            const serialized = JSON.stringify(message);
            await this.client.publish(channel, serialized);
        }
        catch (error) {
            this.failedCommandCount++;
            this.logger.error(`Failed to publish to channel: ${channel}`, error);
            throw error;
        }
    }
    async subscribe(channel, callback) {
        try {
            this.commandCount++;
            await this.client.subscribe(channel);
            this.client.on('message', (ch, message) => {
                if (ch === channel) {
                    try {
                        const parsed = JSON.parse(message);
                        callback(parsed);
                    }
                    catch (error) {
                        this.logger.error(`Failed to parse message from channel: ${channel}`, error);
                    }
                }
            });
        }
        catch (error) {
            this.failedCommandCount++;
            this.logger.error(`Failed to subscribe to channel: ${channel}`, error);
            throw error;
        }
    }
    async disconnect() {
        try {
            await this.client.quit();
            this.isInitialized = false;
            this.logger.info('Redis client disconnected');
        }
        catch (error) {
            this.logger.error('Failed to disconnect Redis client', error);
            throw error;
        }
    }
}
// Export singleton instance with default configuration
export const redisService = RedisService.getInstance({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: 'meme-agent:',
    retryStrategy: (times) => {
        if (times > 10)
            return; // Stop retrying after 10 attempts
        return Math.min(times * 100, 3000); // Exponential backoff with max 3s
    }
});
