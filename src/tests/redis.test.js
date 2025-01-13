import { redisService } from '../services/redis/redis-service.js';
import { Logger } from '../utils/logger.js';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
const logger = new Logger('redis-test');
describe('Redis Basic Operations', () => {
    beforeAll(async () => {
        await redisService.initialize();
    });
    afterAll(async () => {
        await redisService.disconnect();
    });
    it('should set and get values correctly', async () => {
        const testKey = 'test:key';
        const testValue = { message: 'Hello Redis!' };
        await redisService.set(testKey, testValue);
        const retrieved = await redisService.get(testKey);
        expect(retrieved).toBeDefined();
        expect(retrieved?.message).toBe(testValue.message);
    });
    it('should check if key exists', async () => {
        const testKey = 'test:key';
        const exists = await redisService.exists(testKey);
        expect(exists).toBe(true);
    });
    it('should delete keys', async () => {
        const testKey = 'test:key';
        await redisService.delete(testKey);
        const existsAfterDelete = await redisService.exists(testKey);
        expect(existsAfterDelete).toBe(false);
    });
});
describe('Redis TTL Operations', () => {
    it('should handle TTL correctly', async () => {
        const ttlKey = 'test:ttl';
        const ttlValue = { temporary: true };
        const ttlSeconds = 2;
        await redisService.set(ttlKey, ttlValue, ttlSeconds);
        // Check immediately
        const immediate = await redisService.get(ttlKey);
        expect(immediate).toBeDefined();
        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, ttlSeconds * 1000 + 100));
        // Check after expiration
        const afterExpiry = await redisService.get(ttlKey);
        expect(afterExpiry).toBeNull();
    }, 10000); // Increase timeout for TTL test
});
describe('Redis Pub/Sub Operations', () => {
    it('should handle pub/sub messaging', async () => {
        const channel = 'test:channel';
        const testMessage = { event: 'test', data: 'message' };
        let messageReceived = false;
        await redisService.subscribe(channel, (message) => {
            if (JSON.stringify(message) === JSON.stringify(testMessage)) {
                messageReceived = true;
            }
        });
        await redisService.publish(channel, testMessage);
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(messageReceived).toBe(true);
    });
});
describe('Redis Health Check', () => {
    it('should verify Redis health status', async () => {
        const health = await redisService.getHealth();
        expect(health.isConnected).toBe(true);
        expect(health.uptime).toBeGreaterThan(0);
        expect(health.memoryUsage.used).toBeGreaterThan(0);
        logger.info('Redis health check:', health);
    });
});
describe('Redis Error Handling', () => {
    it('should handle invalid JSON', async () => {
        const invalidKey = 'test:invalid';
        await redisService.set(invalidKey, 'invalid json');
        await expect(redisService.get(invalidKey))
            .rejects
            .toThrow();
    });
    it('should handle disconnection errors', async () => {
        await redisService.disconnect();
        await expect(redisService.get('any-key'))
            .rejects
            .toThrow();
        // Reconnect for other tests
        await redisService.initialize();
    });
});
describe('Redis Load Handling', () => {
    it('should handle batch operations', async () => {
        const batchSize = 100; // Reduced batch size for faster tests
        const keyPrefix = 'test:load';
        const start = Date.now();
        // Batch write
        const writePromises = Array.from({ length: batchSize }).map((_, i) => redisService.set(`${keyPrefix}:${i}`, JSON.stringify({ index: i })));
        await Promise.all(writePromises);
        // Batch read
        const readPromises = Array.from({ length: batchSize }).map((_, i) => redisService.get(`${keyPrefix}:${i}`));
        const results = await Promise.all(readPromises);
        // Cleanup
        const deletePromises = Array.from({ length: batchSize }).map((_, i) => redisService.delete(`${keyPrefix}:${i}`));
        await Promise.all(deletePromises);
        const duration = Date.now() - start;
        const opsPerSecond = Math.floor((batchSize * 3) / (duration / 1000));
        logger.info(`Load test completed: ${opsPerSecond} ops/sec`);
        expect(results.every(r => r !== null)).toBe(true);
    }, 30000); // Increase timeout for load test
});
