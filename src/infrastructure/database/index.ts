import { initializePostgres } from './postgresql.config.js';
import { initializeMongoDB, closeMongoDB } from './mongodb.config.js';
import { RedisService } from '../../services/redis/redis-service.js';
import { redisConfig } from './redis.config.js';

export const initializeDatabases = async () => {
  try {
    // Initialize all databases in parallel
    await Promise.all([
      initializePostgres(),
      initializeMongoDB(),
      RedisService.getInstance(redisConfig).initialize(),
    ]);
    
    console.log('All databases initialized successfully');
  } catch (error) {
    console.error('Error initializing databases:', error);
    // Attempt to close any connections that might have been established
    await closeDatabases();
    throw error;
  }
};

export const closeDatabases = async () => {
  try {
    await Promise.all([
      closeMongoDB(),
      RedisService.getInstance(redisConfig).disconnect(),
    ]);
    console.log('All database connections closed');
  } catch (error) {
    console.error('Error closing database connections:', error);
    throw error;
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