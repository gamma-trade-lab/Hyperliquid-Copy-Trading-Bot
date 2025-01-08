import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { exit } from 'process';

// Load environment variables
config();

const requiredEnvVars = [
  // Application
  'NODE_ENV',
  'APP_PORT',
  'APP_HOST',
  'LOG_LEVEL',

  // PostgreSQL
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',

  // MongoDB
  'MONGODB_URI',

  // Redis
  'REDIS_URL',

  // Security
  'JWT_SECRET',
  'JWT_EXPIRATION',

  // Agent Configuration
  'DEFAULT_AGENT_TIMEOUT',
  'MAX_CONCURRENT_TASKS',
  'TASK_QUEUE_SIZE',

  // Lock Configuration
  'LOCK_TTL',
  'LOCK_RETRY_DELAY',
  'MAX_LOCK_RETRIES',

  // Cache Configuration
  'CACHE_TTL',
  'CACHE_CHECK_PERIOD',

  // Event Configuration
  'EVENT_RETENTION_PERIOD',
  'MAX_EVENT_BATCH_SIZE'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  exit(1);
}

// Check if required directories exist
const requiredDirs = [
  'logs',
  'dist',
  'src'
];

const missingDirs = requiredDirs.filter(dir => !existsSync(resolve(process.cwd(), dir)));

if (missingDirs.length > 0) {
  console.error('❌ Missing required directories:');
  missingDirs.forEach(dir => {
    console.error(`   - ${dir}`);
  });
  exit(1);
}

console.log('✅ Environment check passed');
exit(0); 