import Redis from 'ioredis';
import { Logger } from '../../utils/logger.js';

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  retryStrategy?: (times: number) => number | void;
}

interface RedisHealth {
  isConnected: boolean;
  uptime: number;
  memoryUsage: {
    used: number;
    peak: number;
    fragmentation: number;
  };
  commandStats: {
    total: number;
    failedCount: number;
  };
  lastError?: string;
}

export class RedisService {
  private static instance: RedisService;
  private readonly _client: Redis;
  
  // Public getter for client to allow controlled access
  public get client(): Redis {
    return this._client;
  }
  private readonly logger: Logger;
  private isInitialized = false;
  private lastError?: Error;
  private commandCount = 0;
  private failedCommandCount = 0;

  private constructor(config: RedisConfig) {
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

  static getInstance(config: RedisConfig): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService(config);
    }
    return RedisService.instance;
  }

  private setupEventHandlers() {
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

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.client.ping();
      this.isInitialized = true;
      this.logger.info('Redis service initialized successfully');
    } catch (error) {
      this.lastError = error as Error;
      this.logger.error('Failed to initialize Redis service', error);
      throw error;
    }
  }

  async getHealth(): Promise<RedisHealth> {
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
    } catch (error) {
      this.logger.error('Failed to get Redis health info', error);
      throw error;
    }
  }

  private parseMemoryInfo(info: string) {
    const used = this.parseInfoValue(info, 'used_memory_human');
    const peak = this.parseInfoValue(info, 'used_memory_peak_human');
    const frag = this.parseInfoValue(info, 'mem_fragmentation_ratio');

    return {
      used: this.parseMemoryValue(used),
      peak: this.parseMemoryValue(peak),
      fragmentation: Number(frag) || 0
    };
  }

  private parseInfoValue(info: string, key: string): string {
    const match = info.match(new RegExp(`${key}:(.+)`));
    return match ? match[1].trim() : '0';
  }

  private parseMemoryValue(value: string): number {
    const match = value.match(/(\d+(?:\.\d+)?)(K|M|G|T)?/i);
    if (!match) return 0;

    const [, num, unit] = match;
    const multipliers: { [key: string]: number } = {
      'K': 1024,
      'M': 1024 * 1024,
      'G': 1024 * 1024 * 1024,
      'T': 1024 * 1024 * 1024 * 1024
    };

    return Number(num) * (unit ? multipliers[unit.toUpperCase()] : 1);
  }

  private getUptime(info: string): number {
    const uptime = this.parseInfoValue(info, 'uptime_in_seconds');
    return parseInt(uptime) || 0;
  }

  // Cache operations with logging and error handling
  async get<T>(key: string): Promise<T | null> {
    try {
      this.commandCount++;
      const value = await this.client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      this.failedCommandCount++;
      this.logger.error(`Failed to get key: ${key}`, error);
      throw error;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      this.commandCount++;
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      this.failedCommandCount++;
      this.logger.error(`Failed to set key: ${key}`, error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      this.commandCount++;
      await this.client.del(key);
    } catch (error) {
      this.failedCommandCount++;
      this.logger.error(`Failed to delete key: ${key}`, error);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      this.commandCount++;
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.failedCommandCount++;
      this.logger.error(`Failed to check key existence: ${key}`, error);
      throw error;
    }
  }

  // Pub/Sub operations
  async publish(channel: string, message: any): Promise<void> {
    try {
      this.commandCount++;
      const serialized = JSON.stringify(message);
      await this.client.publish(channel, serialized);
    } catch (error) {
      this.failedCommandCount++;
      this.logger.error(`Failed to publish to channel: ${channel}`, error);
      throw error;
    }
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    try {
      this.commandCount++;
      await this.client.subscribe(channel);
      this.client.on('message', (ch, message) => {
        if (ch === channel) {
          try {
            const parsed = JSON.parse(message);
            callback(parsed);
          } catch (error) {
            this.logger.error(`Failed to parse message from channel: ${channel}`, error);
          }
        }
      });
    } catch (error) {
      this.failedCommandCount++;
      this.logger.error(`Failed to subscribe to channel: ${channel}`, error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.isInitialized = false;
      this.logger.info('Redis client disconnected');
    } catch (error) {
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
  retryStrategy: (times: number): number | void => {
    if (times > 10) return; // Stop retrying after 10 attempts
    return Math.min(times * 100, 3000); // Exponential backoff with max 3s
  }
});       