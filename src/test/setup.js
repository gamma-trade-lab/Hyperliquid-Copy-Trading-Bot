import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { jest } from '@jest/globals';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Load test environment variables
config({ path: join(__dirname, '../../.env.test') });
// Set test environment
process.env.NODE_ENV = 'test';
// Helper functions for data compression
const compressData = async (data) => {
    const jsonStr = JSON.stringify(data);
    return gzipAsync(Buffer.from(jsonStr));
};
const decompressData = async (buffer) => {
    const decompressed = await gunzipAsync(buffer);
    return JSON.parse(decompressed.toString());
};
// Create mock historical price data
const createMockHistoricalData = () => ({
    prices: Array.from({ length: 24 }, (_, i) => ({
        timestamp: Date.now() - i * 3600000,
        price: 100 + Math.random() * 10,
        volume: 1000000 + Math.random() * 500000
    }))
});
// Mock Redis client with compression support
jest.mock('ioredis', () => {
    const mockStore = new Map();
    // Helper functions for data encoding/decoding
    const encodeValue = (value) => {
        const jsonStr = typeof value === 'string' ? value : JSON.stringify(value);
        return Buffer.from(jsonStr).toString('base64');
    };
    const decodeValue = (value) => {
        const rawStr = Buffer.from(value, 'base64').toString();
        try {
            return JSON.parse(rawStr);
        }
        catch {
            return rawStr; // Return raw string if JSON parsing fails
        }
    };
    // Create mock Redis instance with all required implementations
    const mockRedis = {
        ping: jest.fn(() => Promise.resolve('PONG')),
        setex: jest.fn(() => Promise.resolve('OK')),
        subscribe: jest.fn(() => Promise.resolve(undefined)),
        info: jest.fn(() => Promise.resolve('redis_version:6.0.0')),
        lrange: jest.fn((key) => {
            if (key.toString().includes('historical:prices')) {
                const data = createMockHistoricalData();
                return Promise.resolve([encodeValue(data)]);
            }
            return Promise.resolve([]);
        }),
        get: jest.fn(async (key) => {
            const value = mockStore.get(key.toString());
            return value || null;
        }),
        set: jest.fn(async (key, value) => {
            const encodedValue = encodeValue(value);
            mockStore.set(key.toString(), encodedValue);
            return 'OK';
        }),
        del: jest.fn(async () => 1),
        on: jest.fn(() => mockRedis),
        connect: jest.fn(async () => undefined),
        disconnect: jest.fn(async () => undefined),
        quit: jest.fn(async () => 'OK'),
        lpush: jest.fn(async () => 1),
        ltrim: jest.fn(async () => 'OK'),
        hget: jest.fn(async () => null),
        hset: jest.fn(async () => 1),
        hmset: jest.fn(async () => 'OK'),
        hgetall: jest.fn(async () => ({})),
        keys: jest.fn(async () => []),
        exists: jest.fn(async () => 0),
        expire: jest.fn(async () => 1),
        status: 'ready'
    };
    // Return a constructor function that returns our mock
    return jest.fn().mockImplementation(() => mockRedis);
});
// Mock MongoDB connection
jest.mock('mongoose', () => {
    const mockConnection = {
        readyState: 1,
        close: jest.fn().mockReturnValue(Promise.resolve())
    };
    const mockModel = {
        find: jest.fn().mockReturnValue(Promise.resolve([])),
        findOne: jest.fn().mockReturnValue(Promise.resolve(null)),
        create: jest.fn().mockReturnValue(Promise.resolve({ _id: 'test-id' })),
        updateOne: jest.fn().mockReturnValue(Promise.resolve({ modifiedCount: 1 })),
        deleteOne: jest.fn().mockReturnValue(Promise.resolve({ deletedCount: 1 }))
    };
    return {
        connect: jest.fn().mockReturnValue(Promise.resolve(mockConnection)),
        connection: mockConnection,
        model: jest.fn().mockReturnValue(mockModel)
    };
});
// Mock PostgreSQL connection
jest.mock('../infrastructure/database/postgresql.config', () => {
    const mockManager = {
        save: jest.fn().mockReturnValue(Promise.resolve({ id: 'test-id' })),
        find: jest.fn().mockReturnValue(Promise.resolve([])),
        findOne: jest.fn().mockReturnValue(Promise.resolve(null)),
        remove: jest.fn().mockReturnValue(Promise.resolve())
    };
    const mockDataSource = {
        initialize: jest.fn().mockReturnValue(Promise.resolve({ isInitialized: true })),
        query: jest.fn().mockReturnValue(Promise.resolve({ rows: [] })),
        manager: mockManager
    };
    return { PostgresDataSource: mockDataSource };
});
// Configure Jest timeout and other globals
jest.setTimeout(30000); // 30 second timeout for all tests
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
