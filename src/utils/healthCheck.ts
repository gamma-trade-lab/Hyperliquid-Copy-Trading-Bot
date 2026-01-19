import { HyperliquidClientWrapper } from '../hyperliquidClient.js';
import { logger } from '../logger.js';
import type { HealthCheckResult, Position } from '../types.js';

/**
 * Health check utility
 * Periodically checks our positions vs target positions
 */

export class HealthChecker {
  private client: HyperliquidClientWrapper;
  private ourAddress: string;
  private targetAddress: string;
  private intervalId?: NodeJS.Timeout;

  constructor(
    client: HyperliquidClientWrapper,
    ourAddress: string,
    targetAddress: string
  ) {
    this.client = client;
    this.ourAddress = ourAddress;
    this.targetAddress = targetAddress;
  }

  /**
   * Start periodic health checks
   */
  start(intervalMinutes: number): void {
    logger.info(`Starting health checks every ${intervalMinutes} minutes`);

    // Run immediately
    this.checkHealth();

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.checkHealth();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop health checks
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info('Health checks stopped');
    }
  }

  /**
   * Perform health check
   */
  private async checkHealth(): Promise<void> {
    try {
      const [ourPositions, targetPositions, ourEquityData, targetEquityData] =
        await Promise.all([
          this.client.getPositions(this.ourAddress),
          this.client.getPositions(this.targetAddress),
          this.client.getAccountEquity(this.ourAddress),
          this.client.getAccountEquity(this.targetAddress),
        ]);

      const ourEquity = ourEquityData.accountValue;
      const targetEquity = targetEquityData.accountValue;

      // Calculate drift between positions
      const drift: Record<string, { ourSize: string; targetSize: string; difference: string }> = {};

      // Check all target positions
      for (const targetPos of targetPositions) {
        const ourPos = ourPositions.find((p) => p.coin === targetPos.coin);
        const targetSize = parseFloat(targetPos.szi);
        const ourSize = ourPos ? parseFloat(ourPos.szi) : 0;
        const difference = Math.abs(targetSize - ourSize);

        if (difference > 0.01) {
          // Significant drift
          drift[targetPos.coin] = {
            ourSize: ourSize.toString(),
            targetSize: targetSize.toString(),
            difference: difference.toString(),
          };
        }
      }

      // Check for positions we have but target doesn't
      for (const ourPos of ourPositions) {
        const targetPos = targetPositions.find((p) => p.coin === ourPos.coin);
        if (!targetPos) {
          drift[ourPos.coin] = {
            ourSize: ourPos.szi,
            targetSize: '0',
            difference: ourPos.szi,
          };
        }
      }

      const result: HealthCheckResult = {
        timestamp: Date.now(),
        ourPositions,
        targetPositions,
        ourEquity,
        targetEquity,
        drift,
      };

      if (Object.keys(drift).length > 0) {
        logger.warn('Health check detected position drift', {
          drift,
          ourEquity,
          targetEquity,
        });
      } else {
        logger.info('Health check passed', {
          ourEquity,
          targetEquity,
          positionCount: ourPositions.length,
        });
      }

      return result;
    } catch (error) {
      logger.error('Health check failed', { error });
      throw error;
    }
  }
}
