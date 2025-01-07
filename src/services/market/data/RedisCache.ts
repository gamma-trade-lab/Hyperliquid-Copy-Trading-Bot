import Redis from 'ioredis';

export class RedisCache {
  private redis: Redis;
  private prefix: string;

  constructor(prefix: string = '') {
    const redisUrl = process.env.REDIS_URL || 'redis://redis-17909.c74.us-east-1-4.ec2.redns.redis-cloud.com:17909';
    const redisPassword = process.env.REDIS_PASSWORD || 'pWFdJwcx9YpojFdQxoCXzGOjMbAvtRwc';

    this.redis = new Redis(redisUrl, {
      password: redisPassword,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.prefix = prefix ? `${prefix}:` : '';

    // Handle connection errors
    this.redis.on('error', (error: Error) => {
      console.error('Redis connection error:', error);
    });

    // Log successful connection
    this.redis.on('connect', () => {
      console.log('Connected to Redis');
    });
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  public async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(this.getKey(key));
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  public async set(key: string, value: string, ttl?: number): Promise<void> {
    const fullKey = this.getKey(key);
    try {
      if (ttl) {
        await this.redis.setex(fullKey, ttl, value);
      } else {
        await this.redis.set(fullKey, value);
      }
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  public async del(key: string): Promise<void> {
    try {
      await this.redis.del(this.getKey(key));
    } catch (error) {
      console.error('Redis del error:', error);
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(this.getKey(key));
      return result === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }

  public async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(this.getKey(key));
    } catch (error) {
      console.error('Redis ttl error:', error);
      return -1;
    }
  }

  public async keys(pattern: string): Promise<string[]> {
    try {
      return await this.redis.keys(this.getKey(pattern));
    } catch (error) {
      console.error('Redis keys error:', error);
      return [];
    }
  }

  public async flushPrefix(): Promise<void> {
    try {
      const keys = await this.keys('*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Redis flush error:', error);
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (error) {
      console.error('Redis disconnect error:', error);
    }
  }
}
