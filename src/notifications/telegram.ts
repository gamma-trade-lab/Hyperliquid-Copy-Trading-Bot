import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { CopyTradeParams, FillEvent, TradeResult } from '../types.js';

/**
 * Telegram notification service
 * Sends notifications when trades are copied
 */

let bot: TelegramBot | null = null;

/**
 * Initialize Telegram bot
 */
export function initTelegramBot(): void {
  if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_CHAT_ID) {
    logger.debug('Telegram notifications disabled (missing token or chat ID)');
    return;
  }

  try {
    bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN);
    logger.info('Telegram bot initialized');
  } catch (error) {
    logger.error('Failed to initialize Telegram bot', { error });
  }
}

/**
 * Send trade notification
 */
export async function sendTradeNotification(
  fill: FillEvent,
  params: CopyTradeParams,
  result: TradeResult
): Promise<void> {
  if (!bot || !config.TELEGRAM_CHAT_ID) {
    return;
  }

  try {
    const message = `
🔄 Trade Copied

📊 Target Trade:
• Coin: ${fill.coin}
• Side: ${fill.dir}
• Size: ${fill.sz}
• Price: ${fill.px}

📈 Our Trade:
• Side: ${params.side === 'B' ? 'Long' : 'Short'}
• Size: ${params.size}
• Leverage: ${params.leverage}x
• Reduce Only: ${params.reduceOnly ? 'Yes' : 'No'}

✅ Status: ${result.success ? 'Success' : 'Failed'}
${result.orderId ? `• Order ID: ${result.orderId}` : ''}
${result.error ? `• Error: ${result.error}` : ''}
    `.trim();

    await bot.sendMessage(config.TELEGRAM_CHAT_ID, message);
    logger.debug('Telegram notification sent');
  } catch (error) {
    logger.error('Failed to send Telegram notification', { error });
  }
}

/**
 * Send error notification
 */
export async function sendErrorNotification(error: string): Promise<void> {
  if (!bot || !config.TELEGRAM_CHAT_ID) {
    return;
  }

  try {
    await bot.sendMessage(config.TELEGRAM_CHAT_ID, `❌ Error: ${error}`);
  } catch (err) {
    logger.error('Failed to send error notification', { err });
  }
}
