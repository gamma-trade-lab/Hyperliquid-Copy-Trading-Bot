import { Mode, ModeConfig } from '@/types/chat.js';
import { TwitterService } from '../social/twitter.js';
import { AIService } from '../ai/ai.js';
import { JupiterPriceV2Service } from '../blockchain/defi/JupiterPriceV2Service.js';
import { elizaLogger } from "@ai16z/eliza";
import { MarketAction } from '../../config/constants.js';
import { MarketData, MarketUpdateData } from '@/types/market.js';
import { MarketAlertCriteria } from './AutoTypes.js'; // Ensure this import

interface AutoModeConfig {
  postInterval?: number;
  marketCheckInterval?: number;
  tokens?: string[];
  alertCriteria?: {
    priceChangeThreshold?: number;
    volumeChangeThreshold?: number;
    timeframe?: number;
  };
  dynamicTokens?: boolean;
  dynamicThresholds?: boolean;
}

export class AutoModeHandler {
  private isRunning: boolean = false;
  private postInterval: number = 30 * 60 * 1000; // 30 minutes default
  private marketCheckInterval: number = 5 * 60 * 1000; // 5 minutes default
  private tokens: string[] = ['SOL', 'JUP', 'BONK'];
  private lastPostTime?: Date;
  private alertCriteria: MarketAlertCriteria = {
    priceChangeThreshold: 5, // 5% price change
    volumeChangeThreshold: 20, // 20% volume change
    timeframe: 3600000 // 1 hour in milliseconds
  };

  constructor(
    private twitterService: TwitterService,
    private aiService: AIService,
    private jupiterService: JupiterPriceV2Service,
    config?: Partial<AutoModeConfig>
  ) {
    if (config) {
      this.postInterval = config.postInterval ?? this.postInterval;
      this.marketCheckInterval = config.marketCheckInterval ?? this.marketCheckInterval;
      this.tokens = config.tokens ?? this.tokens;
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      elizaLogger.warn('Auto mode is already running');
      return;
    }

    this.isRunning = true;
    elizaLogger.info('Starting auto mode...');

    this.startAutonomousPosting();
    this.startMarketMonitoring();

    console.log('\nAuto mode activated! 🤖');
    console.log('Jenna will now autonomously:');
    console.log(`- Post updates every ${this.postInterval / 60000} minutes`);
    console.log(`- Monitor market every ${this.marketCheckInterval / 60000} minutes`);
    console.log('Type "status" to check current status or "mode chat" to switch back to chat mode\n');
  }

  private async startAutonomousPosting(): Promise<void> {
    const postUpdate = async () => {
      try {
        const marketData = await Promise.all(
          this.tokens.map(async (symbol) => {
            try {
              const data = await this.jupiterService.getMarketData(symbol);
              return data ? {
                symbol,
                ...data,
                lastUpdate: Date.now()
              } : null;
            } catch (error) {
              elizaLogger.error(`Error fetching ${symbol} data:`, error);
              return null;
            }
          })
        );

        const validMarketData = marketData.filter((data): data is MarketUpdateData => data !== null);
        
        if (validMarketData.length === 0) {
          elizaLogger.warn('No valid market data available for posting');
          return;
        }

        const content = await this.generateMarketUpdateContent(validMarketData[0]);
        await this.twitterService.postTweet(content);
        this.lastPostTime = new Date();
        elizaLogger.info('Successfully posted autonomous update');

      } catch (error) {
        elizaLogger.error('Error in autonomous posting:', error);
      }
    };

    await postUpdate();
    setInterval(postUpdate, this.postInterval);
  }

  private async startMarketMonitoring(): Promise<void> {
    const checkMarket = async () => {
      try {
        for (const symbol of this.tokens) {
          const rawMarketData = await this.jupiterService.getMarketData(symbol);
          if (!rawMarketData) continue;

          const marketData: MarketData = {
            ...rawMarketData,
            lastUpdate: Date.now(),
            tokenAddress: '',
            topHolders: [],
            volatility: {
              currentVolatility: 0,
              averageVolatility: 0,
              adjustmentFactor: 1
            },
            holders: {
              total: 0,
              top: []
            },
            onChainActivity: {
              transactions: 0,
              swaps: 0,
              uniqueTraders: 0
            }
          };

          if (this.checkAlertConditions(marketData)) {
            const alertContent = await this.generateAlertContent(symbol, marketData);
            await this.twitterService.postTweet(alertContent);
            elizaLogger.info(`Posted market alert for ${symbol}`);
          }
        }
      } catch (error) {
        elizaLogger.error('Error in market monitoring:', error);
      }
    };

    setInterval(checkMarket, this.marketCheckInterval);
  }

  private async generateMarketUpdateContent(marketData: MarketUpdateData): Promise<string> {
    try {
      const content = await this.aiService.generateMarketUpdate({
        action: MarketAction.UPDATE,
        data: {
          price: marketData.price,
          volume24h: marketData.volume24h,
          priceChange24h: marketData.priceChange24h,
          marketCap: marketData.marketCap,
          lastUpdate: marketData.lastUpdate,
          tokenAddress: '',
          topHolders: [],
          volatility: {
            currentVolatility: 0,
            averageVolatility: 0,
            adjustmentFactor: 0
          },
          holders: {
            total: 0,
            top: []
          },
          onChainActivity: {
            transactions: 0,
            swaps: 0,
            uniqueTraders: 0
          }
        },
        platform: 'twitter'
      });
  
      return content || this.generateFallbackContent(marketData);
    } catch (error) {
      elizaLogger.error('Error generating market update content:', error);
      return this.generateFallbackContent(marketData);
    }
  }
  
  private generateFallbackContent(marketData: MarketUpdateData): string {
    return `Market Update 📊\n${marketData.symbol}: $${marketData.price.toFixed(3)} (${marketData.priceChange24h.toFixed(2)}%)`;
  }
  
  private async generateAlertContent(symbol: string, marketData: MarketData): Promise<string> {
    try {
      const content = await this.aiService.generateMarketUpdate({
        action: MarketAction.ALERT,
        data: marketData,
        platform: 'twitter'
      });
  
      return content || `🚨 Market Alert: ${symbol}\nPrice: $${marketData.price.toFixed(3)}\nChange: ${marketData.priceChange24h.toFixed(2)}%`;
    } catch (error) {
      return `🚨 Market Alert: ${symbol}\nPrice: $${marketData.price.toFixed(3)}\nChange: ${marketData.priceChange24h.toFixed(2)}%`;
    }
  }

  private checkAlertConditions(marketData: MarketData): boolean {
    return Math.abs(marketData.priceChange24h) >= this.alertCriteria.priceChangeThreshold;
  }

  public stop(): void {
    this.isRunning = false;
    elizaLogger.info('Auto mode stopped');
  }

  public getStatus(): { isRunning: boolean; lastPost?: Date } {
    return {
      isRunning: this.isRunning,
      lastPost: this.lastPostTime
    };
  }
}