export class VolatilityManager {
    dataProcessor;
    VOLATILITY_WINDOW = 14; // Example window size for ATR calculation
    MAX_POSITION_ADJUSTMENT = 0.8; // Maximum 80% reduction
    MIN_POSITION_ADJUSTMENT = 0.2; // Minimum 20% reduction
    constructor(dataProcessor) {
        this.dataProcessor = dataProcessor;
    }
    /**
     * Calculate Average True Range (ATR) for volatility measurement
     */
    async calculateATR(token) {
        const prices = (await this.dataProcessor.getHistoricalPrices(token, this.VOLATILITY_WINDOW)) || [];
        if (prices.length < 2) {
            return 0;
        }
        let trueRangeSum = 0;
        for (let i = 1; i < prices.length; i++) {
            const high = Math.max(prices[i].high, prices[i - 1].close);
            const low = Math.min(prices[i].low, prices[i - 1].close);
            const trueRange = high - low;
            trueRangeSum += trueRange;
        }
        return trueRangeSum / (prices.length - 1);
    }
    /**
     * Calculate position adjustment factor based on volatility
     */
    calculateAdjustmentFactor(volatility, averageVolatility) {
        if (averageVolatility === 0)
            return 1;
        const volatilityRatio = volatility / averageVolatility;
        const adjustment = Math.max(this.MIN_POSITION_ADJUSTMENT, Math.min(1, 1 / volatilityRatio));
        return Math.min(adjustment, 1 - this.MAX_POSITION_ADJUSTMENT);
    }
    /**
     * Adjust position size based on current market volatility
     */
    async adjustPosition(amount, token) {
        try {
            const volatility = await this.calculateATR(token);
            const averageVolatility = await this.dataProcessor.getAverageVolatility(token);
            if (volatility === 0 || averageVolatility === 0) {
                return amount; // Return original amount if we can't calculate volatility
            }
            const adjustmentFactor = this.calculateAdjustmentFactor(volatility, averageVolatility);
            return amount * adjustmentFactor;
        }
        catch (error) {
            console.error('Error adjusting position for volatility:', error);
            return amount; // Return original amount on error
        }
    }
    /**
     * Get current volatility metrics for a token
     */
    async getVolatilityMetrics(token) {
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
    async getAverageVolatility(token) {
        return await this.calculateATR(token);
    }
}
