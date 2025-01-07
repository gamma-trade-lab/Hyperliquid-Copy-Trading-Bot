import { config } from 'dotenv';
import { join } from 'path';

// Load test environment variables
config({ path: join(__dirname, '../../.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';

// Mock Redis client
jest.mock('ioredis', () => {
  const Redis = require('ioredis-mock');
  return Redis;
});

// Mock MongoDB connection
jest.mock('mongoose', () => ({
  connect: jest.fn().mockResolvedValue({}),
  connection: {
    readyState: 1,
    close: jest.fn().mockResolvedValue(true)
  }
}));

// Mock PostgreSQL connection
jest.mock('../infrastructure/database/postgresql.config', () => ({
  PostgresDataSource: {
    initialize: jest.fn().mockResolvedValue({}),
    query: jest.fn().mockResolvedValue([]),
    manager: {
      save: jest.fn().mockImplementation(entity => Promise.resolve({ ...entity, id: 'test-id' })),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      remove: jest.fn().mockResolvedValue(true)
    }
  }
}));

// Global test setup
beforeAll(() => {
  // Add any global setup here
});

// Global test teardown
afterAll(() => {
  // Add any global cleanup here
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
}); 