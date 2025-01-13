import { redis } from '../redis.config.js';
export class RedisService {
    static instance;
    defaultTTL = 3600; // 1 hour in seconds
    constructor() { }
    static getInstance() {
        if (!RedisService.instance) {
            RedisService.instance = new RedisService();
        }
        return RedisService.instance;
    }
    // Cache operations
    async set(key, value, ttl) {
        const serializedValue = JSON.stringify(value);
        if (ttl) {
            await redis.setex(key, ttl, serializedValue);
        }
        else {
            await redis.setex(key, this.defaultTTL, serializedValue);
        }
    }
    async get(key) {
        const value = await redis.get(key);
        if (!value)
            return null;
        return JSON.parse(value);
    }
    async delete(key) {
        await redis.del(key);
    }
    // Pub/Sub operations
    async publish(channel, message) {
        await redis.publish(channel, JSON.stringify(message));
    }
    async subscribe(channel, callback) {
        await redis.subscribe(channel);
        redis.on('message', (chan, message) => {
            if (chan !== channel)
                return;
            try {
                const parsedMessage = JSON.parse(message);
                callback(parsedMessage);
            }
            catch (error) {
                console.error('Error parsing message:', error);
                callback(message);
            }
        });
    }
    async unsubscribe(channel) {
        await redis.unsubscribe(channel);
    }
    // List operations
    async pushToList(key, value) {
        await redis.lpush(key, JSON.stringify(value));
    }
    async getListRange(key, start, end) {
        const values = await redis.lrange(key, start, end);
        return values.map(value => JSON.parse(value));
    }
    // Set operations
    async addToSet(key, value) {
        await redis.sadd(key, JSON.stringify(value));
    }
    async getSetMembers(key) {
        const values = await redis.smembers(key);
        return values.map(value => JSON.parse(value));
    }
    // Sorted Set operations
    async addToSortedSet(key, score, value) {
        await redis.zadd(key, score, JSON.stringify(value));
    }
    async getSortedSetRange(key, start, end) {
        const values = await redis.zrange(key, start, end);
        return values.map(value => JSON.parse(value));
    }
    // Lock mechanism for distributed operations
    async acquireLock(lockKey, ttl) {
        const acquired = await redis.setnx(lockKey, 'locked');
        if (acquired === 1) {
            await redis.expire(lockKey, ttl);
            return true;
        }
        return false;
    }
    async releaseLock(lockKey) {
        await redis.del(lockKey);
    }
}
