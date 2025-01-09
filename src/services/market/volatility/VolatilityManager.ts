import { MarketDataProcessor } from '../data/DataProcessor';
import { PriceData } from '../../../types/market.js';

export class VolatilityManager {
  private dataProcessor: MarketDataProcessor;
  private readonly VOLATILITY_WINDOW = 14; // Example window size for ATR calculation
  private readonly MAX_POSITION_ADJUSTMENT = 0.8; // Maximum 80% reduction
  private readonly MIN_POSITION_ADJUSTMENT = 0.2; // Minimum 20% reduction

  constructor(dataProcessor: MarketDataProcessor) {
    this.dataProcessor = dataProcessor;
  }

  /**
   * Calculate Average True Range (ATR) for volatility measurement
   */
  private async calculateATR(token: string): Promise<number> {
    const prices: PriceData[] = (await this.dataProcessor.getHistoricalPrices(token, this.VOLATILITY_WINDOW)) || [];
    if (prices.length < 2) {
      return 0;
    }

    let trueRangeSum = 0;
    for (let i = 1; i < prices.length; i++) {
      const high = Math.max(prices[i].high, prices[i-1].close);
      const low = Math.min(prices[i].low, prices[i-1].close);
      const trueRange = high - low;
      trueRangeSum += trueRange;
    }

    return trueRangeSum / (prices.length - 1);
  }

  /**
   * Calculate position adjustment factor based on volatility
   */
  private calculateAdjustmentFactor(volatility: number, averageVolatility: number): number {
    if (averageVolatility === 0) return 1;
    
    const volatilityRatio = volatility / averageVolatility;
    const adjustment = Math.max(
      this.MIN_POSITION_ADJUSTMENT,
      Math.min(1, 1 / volatilityRatio)
    );
    
    return Math.min(adjustment, 1 - this.MAX_POSITION_ADJUSTMENT);
  }

  /**
   * Adjust position size based on current market volatility
   */
  public async adjustPosition(amount: number, token: string): Promise<number> {
    try {
      const volatility = await this.calculateATR(token);
      const averageVolatility = await this.dataProcessor.getAverageVolatility(token);
      
      if (volatility === 0 || averageVolatility === 0) {
        return amount; // Return original amount if we can't calculate volatility
      }

      const adjustmentFactor = this.calculateAdjustmentFactor(volatility, averageVolatility);
      return amount * adjustmentFactor;
    } catch (error) {
      console.error('Error adjusting position for volatility:', error);
      return amount; // Return original amount on error
    }
  }

  /**
   * Get current volatility metrics for a token
   */
  public async getVolatilityMetrics(token: string): Promise<{
    currentVolatility: number;
    averageVolatility: number;
    adjustmentFactor: number;
  }> {
    const currentVolatility = await this.calculateATR(token);
    const averageVolatility = await this.dataProcessor.getAverageVolatility(token);
    const adjustmentFactor = this.calculateAdjustmentFactor(currentVolatility, averageVolatility);

    return {
      currentVolatility,
      averageVolatility,
      adjustmentFactor
    };
  }

  /**
   * Get the average volatility for a token
   */
  public async getAverageVolatility(token: string): Promise<number> {
    return await this.calculateATR(token);
  }
}
