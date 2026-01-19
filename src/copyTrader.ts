import { config } from './config.js';
import { logger } from './logger.js';
import { HyperliquidClientWrapper } from './hyperliquidClient.js';
import {
  calculatePositionSize,
  capLeverage,
  getTradeAction,
  removeTrailingZeros,
  validateTradeParams,
} from './utils/risk.js';
import type {
  CopyTradeParams,
  FillEvent,
  Position,
  TradeResult,
} from './types.js';

/**
 * Core copy trading logic
 * Monitors target wallet and mirrors trades
 */
export class CopyTrader {
  private client: HyperliquidClientWrapper;
  private targetWallet: string;
  private ourAddress: string;
  private activeTrades: Set<string> = new Set(); // Track active trades by coin
  private unsubscribeFn?: () => void;

  constructor(client: HyperliquidClientWrapper, targetWallet: string) {
    this.client = client;
    this.targetWallet = targetWallet;
    this.ourAddress = client.getAddress();
  }

  /**
   * Start monitoring target wallet and copying trades
   */
  async start(): Promise<void> {
    logger.info('Starting copy trader', {
      ourAddress: this.ourAddress,
      targetWallet: this.targetWallet,
      dryRun: config.DRY_RUN,
    });

    // Subscribe to target wallet fills
    this.unsubscribeFn = this.client.subscribeToUserFills(
      this.targetWallet,
      (fill: FillEvent) => this.handleFill(fill)
    );

    logger.info('Copy trader started, monitoring fills...');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = undefined;
    }
    logger.info('Copy trader stopped');
  }

  /**
   * Handle incoming fill event from target wallet
   */
  private async handleFill(fill: FillEvent): Promise<void> {
    try {
      logger.info('Received fill event', {
        coin: fill.coin,
        side: fill.side,
        size: fill.sz,
        price: fill.px,
        direction: fill.dir,
        hash: fill.hash,
      });

      // Determine trade action
      const action = getTradeAction(fill);
      logger.debug('Trade action determined', { action, fill });

      // Get account equities for position sizing
      const [ourEquityData, targetEquityData] = await Promise.all([
        this.client.getAccountEquity(this.ourAddress),
        this.client.getAccountEquity(this.targetWallet),
      ]);

      const ourEquity = parseFloat(ourEquityData.accountValue);
      const targetEquity = parseFloat(targetEquityData.accountValue);

      logger.debug('Account equities', {
        ourEquity,
        targetEquity,
      });

      // Get current positions to determine leverage and reduce-only status
      const [ourPositions, targetPositions] = await Promise.all([
        this.client.getPositions(this.ourAddress),
        this.client.getPositions(this.targetWallet),
      ]);

      const targetPosition = targetPositions.find((p) => p.coin === fill.coin);
      const ourPosition = ourPositions.find((p) => p.coin === fill.coin);

      // Calculate trade parameters
      const tradeParams = await this.calculateTradeParams(
        fill,
        action,
        ourEquity,
        targetEquity,
        targetPosition,
        ourPosition
      );

      if (!tradeParams) {
        logger.warn('Trade parameters calculation failed, skipping');
        return;
      }

      // Execute trade
      const result = await this.executeTrade(tradeParams, fill.px, ourEquity);

      if (result.success) {
        logger.info('Trade executed successfully', {
          orderId: result.orderId,
          params: tradeParams,
        });

        // Track active trade
        if (action === 'open') {
          this.activeTrades.add(fill.coin);
        } else if (action === 'close') {
          this.activeTrades.delete(fill.coin);
        }

        // Send notification if configured
        await this.sendNotification(fill, tradeParams, result);
      } else {
        logger.error('Trade execution failed', {
          error: result.error,
          params: tradeParams,
        });
      }
    } catch (error) {
      logger.error('Error handling fill', { fill, error });
    }
  }

  /**
   * Calculate trade parameters for copying
   */
  private async calculateTradeParams(
    fill: FillEvent,
    action: 'open' | 'reduce' | 'close',
    ourEquity: number,
    targetEquity: number,
    targetPosition: Position | undefined,
    ourPosition: Position | undefined
  ): Promise<CopyTradeParams | null> {
    const coin = fill.coin;
    const fillSize = parseFloat(fill.sz);
    const fillPrice = parseFloat(fill.px);

    // Determine side: B = Buy (Long), A = Sell (Short/Close)
    let side: 'A' | 'B';
    let reduceOnly = false;

    if (action === 'open') {
      // Opening: Long = Buy (B), Short = Sell (A)
      side = fill.dir === 'Open Long' ? 'B' : 'A';
    } else {
      // Reducing/Closing: opposite of position direction
      if (targetPosition) {
        const isLong = parseFloat(targetPosition.szi) > 0;
        side = isLong ? 'A' : 'B'; // Close long = sell, close short = buy
      } else {
        // Fallback: use fill side
        side = fill.side;
      }
      reduceOnly = true;
    }

    // Calculate position size
    const targetSize = fillSize;
    const calculatedSize = calculatePositionSize(
      targetSize,
      ourEquity,
      targetEquity
    );

    // Get leverage from target position or use default
    let leverage = 1;
    if (targetPosition?.leverage) {
      leverage = parseInt(targetPosition.leverage.value);
      leverage = capLeverage(leverage);
    }

    // Check max concurrent trades
    if (action === 'open' && this.activeTrades.size >= config.MAX_CONCURRENT_TRADES) {
      logger.warn('Max concurrent trades reached, skipping', {
        activeTrades: this.activeTrades.size,
        max: config.MAX_CONCURRENT_TRADES,
      });
      return null;
    }

    const sizeStr = removeTrailingZeros(calculatedSize.toFixed(8));

    return {
      coin,
      side,
      size: sizeStr,
      orderType: 'Market', // Use market orders for immediate execution
      reduceOnly,
      leverage,
    };
  }

  /**
   * Execute trade with retry logic
   */
  private async executeTrade(
    params: CopyTradeParams,
    price: string,
    ourEquity: number
  ): Promise<TradeResult> {
    // Validate trade parameters
    const validation = validateTradeParams(params, price, ourEquity);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.reason,
        params,
      };
    }

    // Retry logic
    const maxRetries = 3;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const orderId = await this.client.placeOrder({
          coin: params.coin,
          side: params.side,
          sz: params.size,
          orderType: params.orderType,
          reduceOnly: params.reduceOnly,
          leverage: params.leverage,
        });

        return {
          success: true,
          orderId,
          params,
        };
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Trade execution attempt ${attempt}/${maxRetries} failed`, {
          error,
          params,
        });

        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
          );
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      params,
    };
  }

  /**
   * Send notification (Telegram, etc.)
   */
  private async sendNotification(
    fill: FillEvent,
    params: CopyTradeParams,
    result: TradeResult
  ): Promise<void> {
    // Implement Telegram notification if configured
    // See src/notifications/telegram.ts
    if (config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_CHAT_ID) {
      // Notification will be handled by notification service
      logger.debug('Notification sent', { fill, params, result });
    }
  }

  /**
   * Get active trades count
   */
  getActiveTradesCount(): number {
    return this.activeTrades.size;
  }
}
