// src/services/market/analysis/priceMonitor.ts
import { EventEmitter } from 'events';
import { PublicKey } from '@solana/web3.js';
import { AIService } from '../../ai/ai.js';
import { MarketDataProcessor } from '../data/DataProcessor';
import { elizaLogger } from "@ai16z/eliza";

export interface PricePoint {
  price: number;
  volume: number;
  timestamp: number;
  source: string;
  volatility?: number;
}

export interface PriceAlert {
  id: string;
  token: string;
  condition: 'above' | 'below' | 'change' | 'volatility';
  value: number;
  triggered: boolean;
  createdAt: number;
}

export interface TokenMetrics {
  price: number;
  volume24h: number;
  marketCap: number;
  change24h: number;
  volatility: number;
  highLow: {
    high24h: number;
    low24h: number;
  };
  holders?: {
    total: number;
    top: Array<{ address: string; balance: number; percentage: number }>;
  };
}

export class PriceMonitor extends EventEmitter {
  private dataProcessor: MarketDataProcessor;
  private aiService: AIService;
  private priceHistory: Map<string, PricePoint[]>;
  private alerts: Map<string, PriceAlert>;
  private monitoredTokens: Set<string>;
  private updateIntervals: Map<string, NodeJS.Timeout>;

  private readonly PRICE_HISTORY_LIMIT = 1000;
  private readonly DEFAULT_UPDATE_INTERVAL = 10000; // 10 seconds
  private readonly VOLATILITY_THRESHOLD = 0.05; // 5%
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  constructor(
    dataProcessor: MarketDataProcessor,
    aiService: AIService
  ) {
    super();
    this.dataProcessor = dataProcessor;
    this.aiService = aiService;
    this.priceHistory = new Map();
    this.alerts = new Map();
    this.monitoredTokens = new Set();
    this.updateIntervals = new Map();
  }

  public async startMonitoring(
    tokenAddress: string,
    interval: number = this.DEFAULT_UPDATE_INTERVAL
  ): Promise<void> {
    try {
      if (this.monitoredTokens.has(tokenAddress)) {
        elizaLogger.warn(`Already monitoring token: ${tokenAddress}`);
        return;
      }

      // Initialize with current data
      await this.addToken(tokenAddress);
      this.monitoredTokens.add(tokenAddress);

      // Start monitoring interval
      const updateInterval = setInterval(
        () => this.updateTokenPrice(tokenAddress),
        interval
      );
      this.updateIntervals.set(tokenAddress, updateInterval);

      elizaLogger.info(`Started monitoring ${tokenAddress} with ${interval}ms interval`);
    } catch (error) {
      elizaLogger.error(`Failed to start monitoring ${tokenAddress}:`, error);
      throw error;
    }
  }

  public stopMonitoring(tokenAddress: string): void {
    const interval = this.updateIntervals.get(tokenAddress);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(tokenAddress);
      this.monitoredTokens.delete(tokenAddress);
      elizaLogger.info(`Stopped monitoring ${tokenAddress}`);
    }
  }

  private async addToken(tokenAddress: string): Promise<void> {
    try {
      const marketData = await this.dataProcessor.getMarketData(tokenAddress);
      
      const pricePoint: PricePoint = {
        price: marketData.price,
        volume: marketData.volume24h,
        timestamp: Date.now(),
        source: 'initialization',
        volatility: marketData.volatility
      };

      this.priceHistory.set(tokenAddress, [pricePoint]);
      this.emit('tokenAdded', { tokenAddress, pricePoint });
    } catch (error) {
      elizaLogger.error('Error adding token:', error);
      throw error;
    }
  }

  private async updateTokenPrice(tokenAddress: string): Promise<void> {
    let retryCount = 0;
    
    while (retryCount < this.MAX_RETRY_ATTEMPTS) {
      try {
        const marketData = await this.dataProcessor.getMarketData(tokenAddress);
        
        const pricePoint: PricePoint = {
          price: marketData.price,
          volume: marketData.volume24h,
          timestamp: Date.now(),
          source: 'update',
          volatility: marketData.volatility
        };

        await this.processPriceUpdate(tokenAddress, pricePoint);
        break; // Success, exit retry loop

      } catch (error) {
        retryCount++;
        elizaLogger.warn(`Retry ${retryCount} failed for ${tokenAddress}:`, error);
        
        if (retryCount === this.MAX_RETRY_ATTEMPTS) {
          elizaLogger.error(`Failed to update price after ${retryCount} attempts:`, error);
          this.emit('updateError', { tokenAddress, error });
        } else {
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * retryCount));
        }
      }
    }
  }

  private async processPriceUpdate(tokenAddress: string, pricePoint: PricePoint): Promise<void> {
    // Add to history
    this.addPricePoint(tokenAddress, pricePoint);

    // Check alerts
    await this.checkAlerts(tokenAddress, pricePoint);

    // Analyze significant movements
    await this.analyzeMovement(tokenAddress, pricePoint);

    // Emit update event
    this.emit('priceUpdated', { tokenAddress, pricePoint });
  }

  public async createAlert(alert: Omit<PriceAlert, 'id' | 'triggered' | 'createdAt'>): Promise<string> {
    const id = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newAlert: PriceAlert = {
      ...alert,
      id,
      triggered: false,
      createdAt: Date.now()
    };

    this.alerts.set(id, newAlert);
    this.emit('alertCreated', newAlert);
    return id;
  }

  private addPricePoint(tokenAddress: string, pricePoint: PricePoint): void {
    const history = this.priceHistory.get(tokenAddress) || [];
    history.push(pricePoint);

    if (history.length > this.PRICE_HISTORY_LIMIT) {
      history.shift();
    }

    this.priceHistory.set(tokenAddress, history);
  }

  private async checkAlerts(tokenAddress: string, pricePoint: PricePoint): Promise<void> {
    for (const alert of this.alerts.values()) {
      if (alert.token !== tokenAddress || alert.triggered) continue;

      let triggered = false;
      const previousPrice = this.getPreviousPrice(tokenAddress);

      switch (alert.condition) {
        case 'above':
          triggered = pricePoint.price > alert.value;
          break;
        case 'below':
          triggered = pricePoint.price < alert.value;
          break;
        case 'change':
          if (previousPrice) {
            const change = Math.abs((pricePoint.price - previousPrice) / previousPrice);
            triggered = change > alert.value;
          }
          break;
        case 'volatility':
          triggered = (pricePoint.volatility || 0) > alert.value;
          break;
      }

      if (triggered) {
        alert.triggered = true;
        this.emit('alertTriggered', { alert, pricePoint });
      }
    }
  }

  private async analyzeMovement(tokenAddress: string, pricePoint: PricePoint): Promise<void> {
    const previousPrice = this.getPreviousPrice(tokenAddress);
    if (!previousPrice) return;

    const priceChange = (pricePoint.price - previousPrice) / previousPrice;

    if (Math.abs(priceChange) >= this.VOLATILITY_THRESHOLD) {
      const metrics = this.calculateTokenMetrics(tokenAddress);
      if (!metrics) return;

      const analysis = await this.generatePriceAnalysis(tokenAddress, priceChange, metrics);
      
      this.emit('significantMovement', {
        tokenAddress,
        priceChange,
        metrics,
        analysis
      });
    }
  }

  private async generatePriceAnalysis(
    tokenAddress: string,
    priceChange: number,
    metrics: TokenMetrics
  ): Promise<string> {
    const prompt = `
      Analyze this price movement:
      Token: ${tokenAddress}
      Price Change: ${(priceChange * 100).toFixed(2)}%
      Current Price: $${metrics.price}
      24h Volume: $${metrics.volume24h.toLocaleString()}
      Market Cap: $${metrics.marketCap.toLocaleString()}
      24h High/Low: $${metrics.highLow.high24h} / $${metrics.highLow.low24h}
      Volatility: ${(metrics.volatility * 100).toFixed(2)}%
      Total Holders: ${metrics.holders?.total || 'Unknown'}
      
      Provide a brief analysis of the movement and potential causes.
    `;

    return await this.aiService.generateResponse({
      content: prompt,
      author: 'system',
      platform: 'analysis'
    });
  }

  public calculateTokenMetrics(tokenAddress: string): TokenMetrics | null {
    const history = this.priceHistory.get(tokenAddress);
    if (!history || history.length === 0) return null;

    const current = history[history.length - 1];
    const past24h = history.filter(p => 
      p.timestamp > Date.now() - 24 * 60 * 60 * 1000
    );

    const dayAgo = history.find(p => 
      p.timestamp <= Date.now() - 24 * 60 * 60 * 1000
    ) || history[0];

    return {
      price: current.price,
      volume24h: past24h.reduce((sum, p) => sum + p.volume, 0),
      marketCap: 0, // Will be updated with actual data
      change24h: ((current.price - dayAgo.price) / dayAgo.price) * 100,
      volatility: current.volatility || 0,
      highLow: {
        high24h: Math.max(...past24h.map(p => p.price)),
        low24h: Math.min(...past24h.map(p => p.price))
      }
    };
  }

  private getPreviousPrice(tokenAddress: string): number | null {
    const history = this.priceHistory.get(tokenAddress);
    if (!history || history.length < 2) return null;
    return history[history.length - 2].price;
  }

  public getRecentPrices(tokenAddress: string, limit: number = 100): PricePoint[] {
    const history = this.priceHistory.get(tokenAddress);
    if (!history) return [];
    return history.slice(-limit);
  }

  public cleanup(): void {
    // Clear all monitoring intervals
    this.updateIntervals.forEach(interval => clearInterval(interval));
    this.updateIntervals.clear();
    this.monitoredTokens.clear();
    elizaLogger.info('Price monitor cleaned up');
  }
}