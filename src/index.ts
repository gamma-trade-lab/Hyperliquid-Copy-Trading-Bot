#!/usr/bin/env node

/**
 * Hyperliquid Copy Trading Bot
 * Main entry point
 * 
 * ⚠️ WARNING: This is for educational purposes — trading involves high risk of loss.
 */

import { config } from './config.js';
import { logger } from './logger.js';
import { HyperliquidClientWrapper } from './hyperliquidClient.js';
import { CopyTrader } from './copyTrader.js';
import { HealthChecker } from './utils/healthCheck.js';
import { initTelegramBot } from './notifications/telegram.js';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  try {
    // Create logs directory if it doesn't exist
    if (!existsSync('logs')) {
      await mkdir('logs', { recursive: true });
    }

    logger.info('='.repeat(60));
    logger.info('Hyperliquid Copy Trading Bot Starting...');
    logger.info('='.repeat(60));
    logger.warn('⚠️  WARNING: This is for educational purposes — trading involves high risk of loss.');
    logger.info('Configuration:', {
      testnet: config.TESTNET,
      dryRun: config.DRY_RUN,
      targetWallet: config.TARGET_WALLET,
      sizeMultiplier: config.SIZE_MULTIPLIER,
      maxLeverage: config.MAX_LEVERAGE,
      blockedAssets: config.BLOCKED_ASSETS,
    });

    // Initialize Telegram bot if configured
    if (config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_CHAT_ID) {
      initTelegramBot();
    }

    // Initialize Hyperliquid client
    const client = new HyperliquidClientWrapper();
    await client.initialize(); // Initialize SDK clients
    const ourAddress = client.getAddress();

    logger.info('Our wallet address:', ourAddress);

    // Verify we can connect and get account info
    try {
      const ourEquity = await client.getAccountEquity(ourAddress);
      logger.info('Account connected successfully', {
        accountValue: ourEquity.accountValue,
      });
    } catch (error) {
      logger.error('Failed to connect to account', { error });
      throw new Error('Cannot connect to Hyperliquid account');
    }

    // Initialize copy trader
    const copyTrader = new CopyTrader(client, config.TARGET_WALLET);
    await copyTrader.start();

    // Initialize health checker
    const healthChecker = new HealthChecker(
      client,
      ourAddress,
      config.TARGET_WALLET
    );
    healthChecker.start(config.HEALTH_CHECK_INTERVAL);

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      copyTrader.stop();
      healthChecker.stop();
        process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error });
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
    });

    logger.info('Bot is running. Press Ctrl+C to stop.');
        } catch (error) {
    logger.error('Fatal error during startup', { error });
    process.exit(1);
  }
}

// Run main function
main().catch((error) => {
  logger.error('Fatal error', { error });
    process.exit(1);
  });
