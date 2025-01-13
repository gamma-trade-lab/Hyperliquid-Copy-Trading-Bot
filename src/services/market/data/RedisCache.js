import Redis from 'ioredis';
import { elizaLogger } from "@ai16z/eliza";
import { EventEmitter } from 'events';
export class RedisService extends EventEmitter {
    static createInstance(arg0) {
        throw new Error('Method not implemented.');
    }
    client;
    isConnected = false;
    constructor(config) {
        super();
        this.client = new Redis({
            host: config.host,
            port: config.port,
            password: config.password,
            keyPrefix: config.keyPrefix,
            maxRetriesPerRequest: config.maxRetries || 3,
            enableReadyCheck: true,
            lazyConnect: true
        });
        this.setupEventListeners();
    }
    async get(key) {
        try {
            if (!this.isConnected) {
                await this.connect();
            }
            const value = await this.client.get(key);
            return value ? JSON.parse(value) : undefined;
        }
        catch (error) {
            elizaLogger.error(`Error getting key ${key}:`, error);
            return undefined;
        }
    }
    async set(key, value, options) {
        try {
            if (!this.isConnected) {
                await this.connect();
            }
            if (options?.expires) {
                const ttl = Math.floor((options.expires - Date.now()) / 1000);
                await this.client.setex(key, ttl > 0 ? ttl : 0, JSON.stringify(value));
            }
            else {
                await this.client.set(key, JSON.stringify(value));
            }
        }
        catch (error) {
            elizaLogger.error(`Error setting key ${key}:`, error);
            throw error;
        }
    }
    async delete(key) {
        try {
            if (!this.isConnected) {
                await this.connect();
            }
            await this.client.del(key);
        }
        catch (error) {
            elizaLogger.error(`Error deleting key ${key}:`, error);
            throw error;
        }
    }
    async flushAll() {
        try {
            if (!this.isConnected) {
                await this.connect();
            }
            await this.client.flushall();
            elizaLogger.info('Redis cache flushed successfully');
        }
        catch (error) {
            elizaLogger.error('Failed to flush Redis cache:', error);
            throw error;
        }
    }
    /**
     * Establishes connection to Redis server
     * @throws Error if connection fails
     */
    async connect() {
        try {
            await this.client.connect();
            this.isConnected = true;
        }
        catch (error) {
            elizaLogger.error('Failed to connect to Redis:', error);
            throw error;
        }
    }
    setupEventListeners() {
        this.client.on('connect', () => {
            this.isConnected = true;
            elizaLogger.success('Connected to Redis');
        });
        this.client.on('error', (error) => {
            elizaLogger.error('Redis error:', error);
            this.isConnected = false;
        });
        this.client.on('close', () => {
            this.isConnected = false;
            elizaLogger.warn('Redis connection closed');
        });
    }
    async cleanup() {
        if (this.isConnected) {
            await this.client.quit();
            this.isConnected = false;
        }
    }
}
