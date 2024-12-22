// src/services/market/analysis/priceMonitor.ts

import { EventEmitter } from 'events';
import { Connection, PublicKey } from '@solana/web3.js';
import { AIService } from '../../ai/ai';

interface PricePoint {
  price: number;
  volume: number;
  timestamp: number;
  source: string;
}

interface PriceAlert {
  id: string;
  token: string;
  condition: 'above' | 'below' | 'change';
  value: number;
  triggered: boolean;
  createdAt: number;
}

interface TokenMetrics {
  price: number;
  volume24h: number;
  marketCap: number;
  change24h: number;
  highLow: {
    high24h: number;
    low24h: number;
  };
}

export class PriceMonitor extends EventEmitter {
  private connection: Connection;
  private aiService: AIService;
  private priceHistory: Map<string, PricePoint[]>;
  private alerts: Map<string, PriceAlert>;
  private readonly PRICE_HISTORY_LIMIT = 1000;
  private readonly UPDATE_INTERVAL = 10000; // 10 seconds
  private readonly VOLATILITY_THRESHOLD = 0.05; // 5%

  constructor(
    connection: Connection,
    aiService: AIService
  ) {
    super();
    this.connection = connection;
    this.aiService = aiService;
    this.priceHistory = new Map();
    this.alerts = new Map();
    this.startPriceMonitoring();
  }

  private async startPriceMonitoring(): Promise<void> {
    setInterval(async () => {
      await this.updatePrices();
    }, this.UPDATE_INTERVAL);
  }

  public async addToken(
    tokenAddress: string,
    initialPrice?: number
  ): Promise<void> {
    try {
      const tokenPublicKey = new PublicKey(tokenAddress);
      const price = initialPrice || await this.fetchTokenPrice(tokenPublicKey);

      const pricePoint: PricePoint = {
        price,
        volume: 0,
        timestamp: Date.now(),
        source: 'initialization'
      };

      this.priceHistory.set(tokenAddress, [pricePoint]);
      this.emit('tokenAdded', { tokenAddress, price: pricePoint });
    } catch (error) {
      console.error('Error adding token:', error);
      throw error;
    }
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

  private async updatePrices(): Promise<void> {
    for (const [tokenAddress] of this.priceHistory) {
      try {
        const tokenPublicKey = new PublicKey(tokenAddress);
        const price = await this.fetchTokenPrice(tokenPublicKey);
        const volume = await this.fetchTokenVolume(tokenPublicKey);

        const pricePoint: PricePoint = {
          price,
          volume,
          timestamp: Date.now(),
          source: 'update'
        };

        this.addPricePoint(tokenAddress, pricePoint);
        await this.checkAlerts(tokenAddress, price);
        await this.analyzeMovement(tokenAddress, pricePoint);
      } catch (error) {
        console.error(`Error updating price for ${tokenAddress}:`, error);
      }
    }
  }

  private async fetchTokenPrice(tokenPublicKey: PublicKey): Promise<number> {
    // Implement price fetching logic using Jupiter or other DEX aggregator
    return 0;
  }

  private async fetchTokenVolume(tokenPublicKey: PublicKey): Promise<number> {
    // Implement volume fetching logic
    return 0;
  }

  private addPricePoint(tokenAddress: string, pricePoint: PricePoint): void {
    const history = this.priceHistory.get(tokenAddress) || [];
    history.push(pricePoint);

    // Maintain history limit
    if (history.length > this.PRICE_HISTORY_LIMIT) {
      history.shift();
    }

    this.priceHistory.set(tokenAddress, history);
    this.emit('priceUpdated', { tokenAddress, pricePoint });
  }

  private async checkAlerts(tokenAddress: string, currentPrice: number): Promise<void> {
    for (const alert of this.alerts.values()) {
      if (alert.token === tokenAddress && !alert.triggered) {
        let triggered = false;

        switch (alert.condition) {
          case 'above':
            triggered = currentPrice > alert.value;
            break;
          case 'below':
            triggered = currentPrice < alert.value;
            break;
          case 'change':
            const previousPrice = this.getPreviousPrice(tokenAddress);
            if (previousPrice) {
              const change = Math.abs((currentPrice - previousPrice) / previousPrice);
              triggered = change > alert.value;
            }
            break;
        }

        if (triggered) {
          alert.triggered = true;
          this.emit('alertTriggered', alert);
        }
      }
    }
  }

  private async analyzeMovement(
    tokenAddress: string,
    pricePoint: PricePoint
  ): Promise<void> {
    const history = this.priceHistory.get(tokenAddress) || [];
    if (history.length < 2) return;

    const previousPrice = history[history.length - 2].price;
    const priceChange = (pricePoint.price - previousPrice) / previousPrice;

    if (Math.abs(priceChange) >= this.VOLATILITY_THRESHOLD) {
      const analysis = await this.generatePriceAnalysis(tokenAddress, priceChange);
      this.emit('significantMovement', {
        tokenAddress,
        priceChange,
        analysis
      });
    }
  }

  private async generatePriceAnalysis(
    tokenAddress: string,
    priceChange: number
  ): Promise<string> {
    const history = this.priceHistory.get(tokenAddress) || [];
    const metrics = this.calculateTokenMetrics(history);

    const prompt = `
      Analyze this price movement:
      Token: ${tokenAddress}
      Price Change: ${(priceChange * 100).toFixed(2)}%
      24h Volume: $${metrics.volume24h.toLocaleString()}
      Market Cap: $${metrics.marketCap.toLocaleString()}
      24h High/Low: $${metrics.highLow.high24h} / $${metrics.highLow.low24h}
      
      Provide a brief analysis of the movement and potential causes.
    `;

    return await this.aiService.generateResponse({
        content: prompt,
        platform: ''
    });
  }

  public getTokenMetrics(tokenAddress: string): TokenMetrics | null {
    const history = this.priceHistory.get(tokenAddress);
    if (!history || history.length === 0) return null;

    return this.calculateTokenMetrics(history);
  }

  private calculateTokenMetrics(history: PricePoint[]): TokenMetrics {
    const current = history[history.length - 1];
    const past24h = history.filter(p => 
      p.timestamp > Date.now() - 24 * 60 * 60 * 1000
    );

    const dayAgo = history.find(p => 
      p.timestamp <= Date.now() - 24 * 60 * 60 * 1000
    ) || history[0];

    const metrics: TokenMetrics = {
      price: current.price,
      volume24h: past24h.reduce((sum, p) => sum + p.volume, 0),
      marketCap: 0, // Would need token supply info
      change24h: ((current.price - dayAgo.price) / dayAgo.price) * 100,
      highLow: {
        high24h: Math.max(...past24h.map(p => p.price)),
        low24h: Math.min(...past24h.map(p => p.price))
      }
    };

    return metrics;
  }

  public getRecentPrices(
    tokenAddress: string,
    limit: number = 100
  ): PricePoint[] {
    const history = this.priceHistory.get(tokenAddress);
    if (!history) return [];
    return history.slice(-limit);
  }

  private getPreviousPrice(tokenAddress: string): number | null {
    const history = this.priceHistory.get(tokenAddress);
    if (!history || history.length < 2) return null;
    return history[history.length - 2].price;
  }
}