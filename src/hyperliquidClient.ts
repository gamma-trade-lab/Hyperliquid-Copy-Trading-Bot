import { Wallet } from 'ethers';
import { config } from './config.js';
import { logger } from './logger.js';
import type { AccountEquity, Position } from './types.js';

/**
 * Hyperliquid SDK Client wrapper
 * Handles initialization and provides typed methods for API calls
 * 
 * NOTE: The actual SDK structure may vary. Common options:
 * - @nktkas/hyperliquid (community SDK)
 * - nomeida/hyperliquid (alternative community SDK)
 * - Official Hyperliquid API (direct HTTP/WebSocket)
 * 
 * Adjust imports below based on your chosen SDK.
 * If SDK doesn't exist, you may need to implement direct API calls.
 */

// Placeholder for SDK imports - adjust based on actual package
// Example structure (adjust as needed):
// import { ExchangeClient, InfoClient } from '@nktkas/hyperliquid';
// or
// import Hyperliquid from '@nktkas/hyperliquid';

// For now, we'll use dynamic imports with fallback
let ExchangeClient: any;
let InfoClient: any;
let WebSocketClient: any;

async function loadSDK() {
  try {
    // Try @nktkas/hyperliquid first
    const hyperliquid = await import('@nktkas/hyperliquid');
    ExchangeClient = hyperliquid.ExchangeClient || hyperliquid.default?.ExchangeClient;
    InfoClient = hyperliquid.InfoClient || hyperliquid.default?.InfoClient;
    WebSocketClient = hyperliquid.WebSocketClient || hyperliquid.default?.WebSocketClient;
    
    if (!ExchangeClient || !InfoClient) {
      throw new Error('SDK structure not recognized');
    }
    
    logger.info('Hyperliquid SDK loaded successfully');
  } catch (error) {
    logger.error('Failed to load Hyperliquid SDK', { error });
    logger.warn('You may need to install: npm install @nktkas/hyperliquid');
    logger.warn('Or implement direct API calls to Hyperliquid endpoints');
    throw new Error(
      'Hyperliquid SDK not found. Please install @nktkas/hyperliquid or implement direct API calls.'
    );
  }
}

export class HyperliquidClientWrapper {
  private wallet: Wallet;
  private exchangeClient: any;
  private infoClient: any;
  private wsClient: any;
  private isConnected: boolean = false;
  private baseUrl: string;

  constructor() {
    // Initialize wallet from private key
    this.wallet = new Wallet(config.PRIVATE_KEY);

    // Set base URL based on testnet/mainnet
    this.baseUrl = config.TESTNET
      ? 'https://api.hyperliquid-testnet.xyz'
      : 'https://api.hyperliquid.xyz';

    logger.info('Hyperliquid client wrapper created', {
      address: this.wallet.address,
      testnet: config.TESTNET,
      baseUrl: this.baseUrl,
    });
  }

  /**
   * Initialize SDK clients (call after SDK is loaded)
   */
  async initialize(): Promise<void> {
    await loadSDK();

    // Initialize exchange client for placing orders
    // Adjust constructor parameters based on actual SDK
    this.exchangeClient = new ExchangeClient(this.wallet, {
      baseUrl: this.baseUrl,
      testnet: config.TESTNET,
    });

    // Initialize info client for querying data
    this.infoClient = new InfoClient({ baseUrl: this.baseUrl });

    logger.info('Hyperliquid clients initialized', {
      address: this.wallet.address,
      testnet: config.TESTNET,
    });
  }

  /**
   * Get account equity information
   */
  async getAccountEquity(address: string): Promise<AccountEquity> {
    try {
      const userState = await this.infoClient.userState(address);
      return {
        accountValue: userState.marginSummary?.accountValue || '0',
        totalMarginUsed: userState.marginSummary?.totalMarginUsed || '0',
        totalNtlPos: userState.marginSummary?.totalNtlPos || '0',
        totalRawUsd: userState.marginSummary?.totalRawUsd || '0',
        crossMaintenanceMarginUsed:
          userState.marginSummary?.crossMaintenanceMarginUsed || '0',
        crossMarginSummary: userState.marginSummary?.crossMarginSummary || {},
      };
    } catch (error) {
      logger.error('Failed to get account equity', { address, error });
      throw error;
    }
  }

  /**
   * Get open positions for an address
   */
  async getPositions(address: string): Promise<Position[]> {
    try {
      const userState = await this.infoClient.userState(address);
      return (userState.assetPositions || []).map((pos: any) => ({
        coin: pos.position.coin,
        szi: pos.position.szi,
        entryPx: pos.position.entryPx,
        leverage: pos.position.leverage,
        liquidationPx: pos.position.liquidationPx,
        marginUsed: pos.position.marginUsed,
        returnOnEquity: pos.position.returnOnEquity,
        unrealizedPnl: pos.position.unrealizedPnl,
      }));
    } catch (error) {
      logger.error('Failed to get positions', { address, error });
      throw error;
    }
  }

  /**
   * Place an order
   * Returns order ID or throws error
   */
  async placeOrder(params: {
    coin: string;
    side: 'A' | 'B';
    sz: string; // Size (no trailing zeros)
    limitPx?: string; // Limit price (for limit orders)
    orderType: 'Limit' | 'Market';
    reduceOnly: boolean;
    leverage: number;
  }): Promise<string> {
    try {
      // Hyperliquid-specific: no trailing zeros in size/price
      const orderParams = {
        ...params,
        sz: params.sz.replace(/\.?0+$/, ''),
        limitPx: params.limitPx?.replace(/\.?0+$/, ''),
      };

      logger.info('Placing order', orderParams);

      if (config.DRY_RUN) {
        logger.warn('DRY RUN: Order not placed', orderParams);
        return 'dry-run-order-id';
      }

      // Set leverage first if needed
      if (params.leverage > 1) {
        await this.exchangeClient.updateLeverage({
          coin: params.coin,
          leverage: params.leverage,
          isCross: false, // Isolated margin
        });
      }

      // Place order
      const result = await this.exchangeClient.order(orderParams, {
        type: params.orderType,
        tif: 'Gtc', // Good till cancel
        reduceOnly: params.reduceOnly,
      });

      logger.info('Order placed successfully', {
        orderId: result.status?.resting?.oid || result.status?.filled?.oid,
        params: orderParams,
      });

      return result.status?.resting?.oid || result.status?.filled?.oid || 'unknown';
    } catch (error) {
      logger.error('Failed to place order', { params, error });
      throw error;
    }
  }

  /**
   * Subscribe to user fills via WebSocket
   * Returns unsubscribe function
   */
  subscribeToUserFills(
    address: string,
    onFill: (fill: any) => void
  ): () => void {
    try {
      const wsUrl = config.TESTNET
        ? 'wss://api.hyperliquid-testnet.xyz/ws'
        : 'wss://api.hyperliquid.xyz/ws';

      // Initialize WebSocket client
      // Adjust based on actual SDK WebSocket implementation
      const ws = await import('ws');
      const WebSocket = ws.default || ws;
      
      if (WebSocketClient) {
        this.wsClient = new WebSocketClient(wsUrl);
      } else {
        // Fallback to native WebSocket or ws library
        this.wsClient = new WebSocket(wsUrl);
      }

      this.wsClient.on('open', () => {
        logger.info('WebSocket connected', { address });
        this.isConnected = true;

        // Subscribe to user fills
        this.wsClient.send(
          JSON.stringify({
            method: 'subscribe',
            subscription: {
              type: 'userFills',
              user: address,
            },
          })
        );
      });

      this.wsClient.on('message', (data: string) => {
        try {
          const message = JSON.parse(data);
          if (message.channel === 'userFills' && message.data) {
            message.data.forEach((fill: any) => {
              onFill(fill);
            });
          }
        } catch (error) {
          logger.error('Failed to parse WebSocket message', { error, data });
        }
      });

      this.wsClient.on('error', (error: Error) => {
        logger.error('WebSocket error', { error });
        this.isConnected = false;
      });

      this.wsClient.on('close', () => {
        logger.warn('WebSocket closed, attempting reconnect...');
        this.isConnected = false;
        this.reconnect(address, onFill);
      });

      // Return unsubscribe function
      return () => {
        if (this.wsClient) {
          this.wsClient.close();
          this.isConnected = false;
        }
      };
    } catch (error) {
      logger.error('Failed to subscribe to user fills', { address, error });
      throw error;
    }
  }

  /**
   * Reconnect WebSocket with exponential backoff
   */
  private reconnect(address: string, onFill: (fill: any) => void, attempt = 1): void {
    const maxAttempts = 10;
    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);

    if (attempt > maxAttempts) {
      logger.error('Max reconnection attempts reached');
      return;
    }

    setTimeout(() => {
      logger.info(`Reconnection attempt ${attempt}/${maxAttempts}`);
      try {
        this.subscribeToUserFills(address, onFill);
      } catch (error) {
        logger.error('Reconnection failed', { attempt, error });
        this.reconnect(address, onFill, attempt + 1);
      }
    }, delay);
  }

  /**
   * Get our wallet address
   */
  getAddress(): string {
    return this.wallet.address;
  }

  /**
   * Check if WebSocket is connected
   */
  isWsConnected(): boolean {
    return this.isConnected;
  }
}
