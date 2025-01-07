import { redisService } from '../services/redis/redis-service.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('redis-test');

interface TestResult {
  name: string;
  success: boolean;
  error?: Error;
  duration: number;
}

async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<TestResult> {
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    logger.info(`✓ Test passed: ${name} (${duration}ms)`);
    return { name, success: true, duration };
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`✗ Test failed: ${name}`, error as Error);
    return { name, success: false, error: error as Error, duration };
  }
}

async function testBasicOperations() {
  // Test initialization
  await redisService.initialize();
  
  // Test set and get
  const testKey = 'test:key';
  const testValue = { message: 'Hello Redis!' };
  await redisService.set(testKey, testValue);
  
  const retrieved = await redisService.get<typeof testValue>(testKey);
  if (!retrieved || retrieved.message !== testValue.message) {
    throw new Error('Get/Set test failed: values do not match');
  }

  // Test exists
  const exists = await redisService.exists(testKey);
  if (!exists) {
    throw new Error('Exists test failed: key should exist');
  }

  // Test delete
  await redisService.delete(testKey);
  const existsAfterDelete = await redisService.exists(testKey);
  if (existsAfterDelete) {
    throw new Error('Delete test failed: key should not exist');
  }
}

async function testTTL() {
  const ttlKey = 'test:ttl';
  const ttlValue = { temporary: true };
  const ttlSeconds = 2;

  await redisService.set(ttlKey, ttlValue, ttlSeconds);
  
  // Check immediately
  const immediate = await redisService.get(ttlKey);
  if (!immediate) {
    throw new Error('TTL test failed: value should exist immediately');
  }

  // Wait for expiration
  await new Promise(resolve => setTimeout(resolve, ttlSeconds * 1000 + 100));
  
  // Check after expiration
  const afterExpiry = await redisService.get(ttlKey);
  if (afterExpiry) {
    throw new Error('TTL test failed: value should have expired');
  }
}

async function testPubSub() {
  const channel = 'test:channel';
  const testMessage = { event: 'test', data: 'message' };
  let messageReceived = false;

  // Subscribe to channel
  await redisService.subscribe(channel, (message) => {
    if (JSON.stringify(message) === JSON.stringify(testMessage)) {
      messageReceived = true;
    }
  });

  // Publish message
  await redisService.publish(channel, testMessage);

  // Wait for message processing
  await new Promise(resolve => setTimeout(resolve, 100));

  if (!messageReceived) {
    throw new Error('Pub/Sub test failed: message not received');
  }
}

async function testHealthCheck() {
  const health = await redisService.getHealth();
  
  if (!health.isConnected) {
    throw new Error('Health check failed: Redis is not connected');
  }

  if (health.uptime <= 0) {
    throw new Error('Health check failed: Invalid uptime');
  }

  if (health.memoryUsage.used <= 0) {
    throw new Error('Health check failed: Invalid memory usage');
  }

  logger.info('Redis health check:', health);
}

async function testErrorHandling() {
  // Test invalid JSON
  const invalidKey = 'test:invalid';
  await redisService.set(invalidKey, 'invalid json');
  
  try {
    await redisService.get(invalidKey);
    throw new Error('Error handling test failed: should throw on invalid JSON');
  } catch (error) {
    // Expected error
  }

  // Test connection error handling
  try {
    await redisService.disconnect();
    await redisService.get('any-key');
    throw new Error('Error handling test failed: should throw on disconnected client');
  } catch (error) {
    // Expected error
  } finally {
    // Reconnect if needed
    await redisService.initialize();
  }
}

async function testLoadHandling() {
  const batchSize = 1000;
  const keyPrefix = 'test:load';
  const start = Date.now();

  // Batch write
  const writePromises = Array.from({ length: batchSize }).map((_, i) =>
    redisService.set(`${keyPrefix}:${i}`, { index: i })
  );
  await Promise.all(writePromises);

  // Batch read
  const readPromises = Array.from({ length: batchSize }).map((_, i) =>
    redisService.get(`${keyPrefix}:${i}`)
  );
  const results = await Promise.all(readPromises);

  // Cleanup
  const deletePromises = Array.from({ length: batchSize }).map((_, i) =>
    redisService.delete(`${keyPrefix}:${i}`)
  );
  await Promise.all(deletePromises);

  const duration = Date.now() - start;
  const opsPerSecond = Math.floor((batchSize * 3) / (duration / 1000));

  logger.info(`Load test completed: ${opsPerSecond} ops/sec`);
  
  if (results.some(r => r === null)) {
    throw new Error('Load handling test failed: some values were not retrieved');
  }
}

async function runAllTests() {
  logger.info('Starting Redis tests...');
  
  const tests = [
    { name: 'Basic Operations', fn: testBasicOperations },
    { name: 'TTL Functionality', fn: testTTL },
    { name: 'Pub/Sub Operations', fn: testPubSub },
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Error Handling', fn: testErrorHandling },
    { name: 'Load Handling', fn: testLoadHandling }
  ];

  const results: TestResult[] = [];
  for (const test of tests) {
    results.push(await runTest(test.name, test.fn));
  }

  // Print summary
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const passedTests = results.filter(r => r.success).length;
  
  logger.info('\nTest Summary:');
  logger.info(`Total Tests: ${results.length}`);
  logger.info(`Passed: ${passedTests}`);
  logger.info(`Failed: ${results.length - passedTests}`);
  logger.info(`Total Duration: ${totalDuration}ms`);

  // Cleanup
  await redisService.disconnect();
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    logger.error('Test suite failed:', error);
    process.exit(1);
  });
}       