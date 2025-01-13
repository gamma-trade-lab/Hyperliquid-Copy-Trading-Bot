import { ICacheManager } from "@elizaos/core";
import Redis from 'ioredis';
import { elizaLogger } from "@ai16z/eliza";
import { EventEmitter } from 'events';

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  keyPrefix?: string;
  enableCircuitBreaker?: boolean;
  maxRetries?: number;
  retryStrategy?: (times: number) => number | void;
  tls?: {
    enabled?: boolean;
    rejectUnauthorized?: boolean;
  };
}

export class RedisService extends EventEmitter implements ICacheManager {
  static createInstance(arg0: { host: string; port: number; password: string | undefined; }): ICacheManager {
    throw new Error('Method not implemented.');
  }
  private client: Redis;
  private isConnected: boolean = false;
  
  constructor(config: RedisConfig) {
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

  public async get<T>(key: string): Promise<T | undefined> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : undefined;
    } catch (error) {
      elizaLogger.error(`Error getting key ${key}:`, error);
      return undefined;
    }
  }

  public async set(key: string, value: any, options?: { expires?: number }): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      if (options?.expires) {
        const ttl = Math.floor((options.expires - Date.now()) / 1000);
        await this.client.setex(key, ttl > 0 ? ttl : 0, JSON.stringify(value));
      } else {
        await this.client.set(key, JSON.stringify(value));
      }
    } catch (error) {
      elizaLogger.error(`Error setting key ${key}:`, error);
      throw error;
    }
  }

  public async delete(key: string): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      await this.client.del(key);
    } catch (error) {
      elizaLogger.error(`Error deleting key ${key}:`, error);
      throw error;
    }
  }

  public async flushAll(): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      await this.client.flushall();
      elizaLogger.info('Redis cache flushed successfully');
    } catch (error) {
      elizaLogger.error('Failed to flush Redis cache:', error);
      throw error;
    }
  }

  /**
   * Establishes connection to Redis server
   * @throws Error if connection fails
   */
  public async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.isConnected = true;
    } catch (error) {
      elizaLogger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
      elizaLogger.success('Connected to Redis');
    });

    this.client.on('error', (error: Error) => {
      elizaLogger.error('Redis error:', error);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      this.isConnected = false;
      elizaLogger.warn('Redis connection closed');
    });
  }

  public async cleanup(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }
}