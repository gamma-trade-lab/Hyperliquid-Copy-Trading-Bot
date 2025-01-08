import { redisService } from '../src/services/redis/redis-service';
import { Logger } from '../src/utils/logger';
import fs from 'fs';
import path from 'path';

const logger = new Logger({
  minLevel: 'debug',
  service: 'redis-test-runner'
});

interface TestReport {
  timestamp: string;
  environment: {
    node: string;
    platform: string;
    redis: {
      host: string;
      port: number;
      version?: string;
    };
  };
  results: {
    name: string;
    success: boolean;
    duration: number;
    error?: string;
  }[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    totalDuration: number;
    averageDuration: number;
  };
  health: {
    memory: {
      used: number;
      peak: number;
      fragmentation: number;
    };
    operations: {
      total: number;
      failed: number;
      successRate: number;
    };
    uptime: number;
  };
}

async function getRedisVersion(): Promise<string> {
  try {
    const info = await redisService.client.info();
    const match = info.match(/redis_version:(\S+)/);
    return match ? match[1] : 'unknown';
  } catch {
    return 'unknown';
  }
}

async function generateReport(testResults: any[]): Promise<TestReport> {
  const health = await redisService.getHealth();
  
  const report: TestReport = {
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        version: await getRedisVersion()
      }
    },
    results: testResults.map(result => ({
      name: result.name,
      success: result.success,
      duration: result.duration,
      error: result.error?.message
    })),
    summary: {
      totalTests: testResults.length,
      passed: testResults.filter(r => r.success).length,
      failed: testResults.filter(r => !r.success).length,
      totalDuration: testResults.reduce((sum, r) => sum + r.duration, 0),
      averageDuration: testResults.reduce((sum, r) => sum + r.duration, 0) / testResults.length
    },
    health: {
      memory: health.memoryUsage,
      operations: {
        total: health.commandStats.total,
        failed: health.commandStats.failedCount,
        successRate: health.commandStats.total > 0 
          ? (health.commandStats.total - health.commandStats.failedCount) / health.commandStats.total 
          : 1
      },
      uptime: health.uptime
    }
  };

  return report;
}

function saveReport(report: TestReport) {
  const reportsDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const filename = `redis-test-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const filepath = path.join(reportsDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  logger.info(`Test report saved to: ${filepath}`);

  // Also save latest report
  const latestPath = path.join(reportsDir, 'redis-test-latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(report, null, 2));
}

function printReport(report: TestReport) {
  logger.info('\n=== Redis Test Report ===\n');
  
  logger.info('Environment:');
  logger.info(`Node.js: ${report.environment.node}`);
  logger.info(`Platform: ${report.environment.platform}`);
  logger.info(`Redis: ${report.environment.redis.version} @ ${report.environment.redis.host}:${report.environment.redis.port}\n`);

  logger.info('Test Results:');
  report.results.forEach(result => {
    const status = result.success ? '✓' : '✗';
    const message = `${status} ${result.name} (${result.duration}ms)`;
    if (result.success) {
      logger.info(message);
    } else {
      logger.error(message);
      if (result.error) {
        logger.error(`  Error: ${result.error}`);
      }
    }
  });

  logger.info('\nSummary:');
  logger.info(`Total Tests: ${report.summary.totalTests}`);
  logger.info(`Passed: ${report.summary.passed}`);
  logger.info(`Failed: ${report.summary.failed}`);
  logger.info(`Total Duration: ${report.summary.totalDuration}ms`);
  logger.info(`Average Duration: ${Math.round(report.summary.averageDuration)}ms\n`);

  logger.info('Health Metrics:');
  logger.info(`Memory Usage: ${formatBytes(report.health.memory.used)} (Peak: ${formatBytes(report.health.memory.peak)})`);
  logger.info(`Memory Fragmentation: ${report.health.memory.fragmentation.toFixed(2)}`);
  logger.info(`Operations: ${report.health.operations.total} total, ${report.health.operations.failed} failed`);
  logger.info(`Success Rate: ${(report.health.operations.successRate * 100).toFixed(2)}%`);
  logger.info(`Uptime: ${formatDuration(report.health.uptime)}\n`);
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`);

  return parts.join(' ');
}

async function main() {
  try {
    // Initialize Redis
    await redisService.initialize();
    logger.info('Redis connection established');

    // Run tests
    const { runAllTests } = require('../src/tests/redis.test');
    const testResults = await runAllTests();

    // Generate and save report
    const report = await generateReport(testResults);
    saveReport(report);
    printReport(report);

    // Cleanup
    await redisService.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Test runner failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
} 