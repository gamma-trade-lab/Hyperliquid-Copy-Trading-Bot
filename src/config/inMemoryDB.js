import Redis from 'ioredis';
const redisUrl = `redis://${process.env.REDIS_USERNAME || 'default'}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}/${process.env.REDIS_DB || '0'}`;
const redisClient = new Redis(redisUrl, {
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
});
export default redisClient;
