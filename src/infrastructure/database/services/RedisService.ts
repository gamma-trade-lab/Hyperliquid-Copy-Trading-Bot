import { redis } from '../redis.config.js';
import { Redis } from 'ioredis';

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
      await redis.setex(key, ttl, serializedValue);
    } else {
      await redis.setex(key, this.defaultTTL, serializedValue);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  }

  async delete(key: string): Promise<void> {
    await redis.del(key);
  }

  // Pub/Sub operations
  async publish(channel: string, message: any): Promise<void> {
    await redis.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, callback: (message: string | Record<string, unknown>) => void): Promise<void> {
    await redis.subscribe(channel);
    redis.on('message', (chan: string, message: string) => {
      if (chan !== channel) return;
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
    await redis.unsubscribe(channel);
  }

  // List operations
  async pushToList(key: string, value: any): Promise<void> {
    await redis.lpush(key, JSON.stringify(value));
  }

  async getListRange<T>(key: string, start: number, end: number): Promise<T[]> {
    const values = await redis.lrange(key, start, end);
    return values.map(value => JSON.parse(value)) as T[];
  }

  // Set operations
  async addToSet(key: string, value: any): Promise<void> {
    await redis.sadd(key, JSON.stringify(value));
  }

  async getSetMembers<T>(key: string): Promise<T[]> {
    const values = await redis.smembers(key);
    return values.map(value => JSON.parse(value)) as T[];
  }

  // Sorted Set operations
  async addToSortedSet(key: string, score: number, value: any): Promise<void> {
    await redis.zadd(key, score, JSON.stringify(value));
  }

  async getSortedSetRange<T>(key: string, start: number, end: number): Promise<T[]> {
    const values = await redis.zrange(key, start, end);
    return values.map(value => JSON.parse(value)) as T[];
  }

  // Lock mechanism for distributed operations
  async acquireLock(lockKey: string, ttl: number): Promise<boolean> {
    const acquired = await redis.setnx(lockKey, 'locked');
    if (acquired === 1) {
      await redis.expire(lockKey, ttl);
      return true;
    }
    return false;
  }

  async releaseLock(lockKey: string): Promise<void> {
    await redis.del(lockKey);
  }
}          