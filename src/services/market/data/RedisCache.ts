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

export class RedisService extends EventEmitter {
  private client: Redis;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 5;
  private readonly defaultRetryDelay: number = 1000;

  constructor(config: RedisConfig) {
    super();

    const defaultConfig: RedisConfig = {
      host: 'localhost',
      port: 6379,
      maxRetries: 3,
      keyPrefix: '',
      enableCircuitBreaker: true,
      retryStrategy: (times: number) => {
        if (times > this.maxReconnectAttempts) {
          elizaLogger.error('Max Redis reconnection attempts reached');
          return; // Stop retrying by returning void
        }
        const delay = Math.min(times * this.defaultRetryDelay, 5000);
        elizaLogger.info(`Retrying Redis connection in ${delay}ms... (attempt ${times})`);
        return delay;
      }
    };

    const finalConfig = {
      ...defaultConfig,
      ...config,
      // Ensure we're not using Unix socket paths
      path: undefined
    };

    // Create Redis client with explicit host/port configuration
    this.client = new Redis({
      host: finalConfig.host,
      port: finalConfig.port,
      password: finalConfig.password,
      keyPrefix: finalConfig.keyPrefix,
      retryStrategy: finalConfig.retryStrategy,
      maxRetriesPerRequest: finalConfig.maxRetries,
      enableReadyCheck: true,
      lazyConnect: true,
      showFriendlyErrorStack: true,
      // TLS configuration if needed
      tls: finalConfig.tls?.enabled ? {
        rejectUnauthorized: finalConfig.tls.rejectUnauthorized ?? false
      } : undefined,
      // Disable auto-reconnect initially
      reconnectOnError: (err) => {
        elizaLogger.error('Redis connection error:', err);
        return false;
      }
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      elizaLogger.success('Connected to Redis');
      this.emit('connect');
    });

    this.client.on('error', (error: Error) => {
      elizaLogger.error('Redis error:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      if (error.message.includes('ENOENT') && error.message.includes('/tokens')) {
        elizaLogger.error('Invalid Redis connection configuration. Please check host and port settings.');
        this.cleanup();
      }
      
      this.emit('error', error);
    });

    this.client.on('close', () => {
      this.isConnected = false;
      elizaLogger.warn('Redis connection closed');
      this.emit('close');
    });

    this.client.on('reconnecting', () => {
      this.reconnectAttempts++;
      elizaLogger.info(`Reconnecting to Redis (attempt ${this.reconnectAttempts})`);
      this.emit('reconnecting', this.reconnectAttempts);
    });

    this.client.on('ready', () => {
      elizaLogger.info('Redis client ready');
      this.emit('ready');
    });
  }

  public async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      elizaLogger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  public async get(key: string): Promise<string | null> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      return await this.client.get(key);
    } catch (error) {
      elizaLogger.error(`Error getting key ${key}:`, error);
      throw error;
    }
  }

  public async set(key: string, value: string, ttl?: number): Promise<'OK'> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      if (ttl) {
        return await this.client.set(key, value, 'EX', ttl);
      }
      return await this.client.set(key, value);
    } catch (error) {
      elizaLogger.error(`Error setting key ${key}:`, error);
      throw error;
    }
  }

  public async cleanup(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.quit();
        this.isConnected = false;
        elizaLogger.info('Redis connection closed gracefully');
      }
    } catch (error) {
      elizaLogger.error('Error during Redis cleanup:', error);
      throw error;
    }
  }

  public isReady(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }

  public getClient(): Redis {
    return this.client;
  }
}