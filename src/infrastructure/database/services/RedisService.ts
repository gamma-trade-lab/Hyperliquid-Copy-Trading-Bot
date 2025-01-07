import { redisClient } from '../redis.config';

export class RedisService {
  private static instance: RedisService;
  private readonly defaultTTL = 3600; // 1 hour in seconds

  private constructor() {}

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  // Cache operations
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serializedValue = JSON.stringify(value);
    if (ttl) {
      await redisClient.setEx(key, ttl, serializedValue);
    } else {
      await redisClient.setEx(key, this.defaultTTL, serializedValue);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await redisClient.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  }

  async delete(key: string): Promise<void> {
    await redisClient.del(key);
  }

  // Pub/Sub operations
  async publish(channel: string, message: any): Promise<void> {
    await redisClient.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    await redisClient.subscribe(channel, (message) => {
      try {
        const parsedMessage = JSON.parse(message);
        callback(parsedMessage);
      } catch (error) {
        console.error('Error parsing message:', error);
        callback(message);
      }
    });
  }

  async unsubscribe(channel: string): Promise<void> {
    await redisClient.unsubscribe(channel);
  }

  // List operations
  async pushToList(key: string, value: any): Promise<void> {
    await redisClient.lPush(key, JSON.stringify(value));
  }

  async getListRange<T>(key: string, start: number, end: number): Promise<T[]> {
    const values = await redisClient.lRange(key, start, end);
    return values.map(value => JSON.parse(value)) as T[];
  }

  // Set operations
  async addToSet(key: string, value: any): Promise<void> {
    await redisClient.sAdd(key, JSON.stringify(value));
  }

  async getSetMembers<T>(key: string): Promise<T[]> {
    const values = await redisClient.sMembers(key);
    return values.map(value => JSON.parse(value)) as T[];
  }

  // Sorted Set operations
  async addToSortedSet(key: string, score: number, value: any): Promise<void> {
    await redisClient.zAdd(key, { score, value: JSON.stringify(value) });
  }

  async getSortedSetRange<T>(key: string, start: number, end: number): Promise<T[]> {
    const values = await redisClient.zRange(key, start, end);
    return values.map(value => JSON.parse(value)) as T[];
  }

  // Lock mechanism for distributed operations
  async acquireLock(lockKey: string, ttl: number): Promise<boolean> {
    const acquired = await redisClient.setNX(lockKey, 'locked');
    if (acquired) {
      await redisClient.expire(lockKey, ttl);
    }
    return acquired;
  }

  async releaseLock(lockKey: string): Promise<void> {
    await redisClient.del(lockKey);
  }
} 