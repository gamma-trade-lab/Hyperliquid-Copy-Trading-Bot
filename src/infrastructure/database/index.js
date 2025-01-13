import { initializePostgres } from './postgresql.config.js';
import { initializeMongoDB, closeMongoDB } from './mongodb.config.js';
import { RedisService } from '../../services/redis/redis-service.js';
import { redisConfig } from './redis.config.js';
export const initializeDatabases = async () => {
    let mongodbInitialized = false;
    try {
        // Initialize Redis first since it's required
        await RedisService.getInstance(redisConfig).initialize();
        console.log('Redis initialized successfully');
        // Initialize PostgreSQL since it's required
        await initializePostgres();
        console.log('PostgreSQL initialized successfully');
        // Try to initialize MongoDB but don't fail if it's not available
        try {
            await initializeMongoDB();
            console.log('MongoDB initialized successfully');
            mongodbInitialized = true;
        }
        catch (error) {
            const mongoError = error;
            console.warn('MongoDB initialization failed (optional):', mongoError.message);
            // Don't throw error for MongoDB - it's optional
        }
        console.log('Required databases initialized successfully');
        return { mongodbInitialized };
    }
    catch (error) {
        console.error('Error initializing required databases:', error);
        // Attempt to close any connections that might have been established
        await closeDatabases();
        throw error;
    }
};
export const closeDatabases = async () => {
    const errors = [];
    // Close Redis
    try {
        await RedisService.getInstance(redisConfig).disconnect();
        console.log('Redis connection closed');
    }
    catch (error) {
        errors.push(['Redis', error]);
        console.error('Error closing Redis connection:', error);
    }
    // Try to close MongoDB if it was initialized
    try {
        await closeMongoDB();
        console.log('MongoDB connection closed');
    }
    catch (error) {
        console.warn('Error closing MongoDB connection (optional):', error);
    }
    if (errors.length > 0) {
        throw new Error('Failed to close some database connections: ' +
            errors.map(([db, err]) => `${db}: ${err.message}`).join(', '));
    }
};
// Handle process termination gracefully
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Closing database connections...');
    await closeDatabases();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('SIGINT received. Closing database connections...');
    await closeDatabases();
    process.exit(0);
});
