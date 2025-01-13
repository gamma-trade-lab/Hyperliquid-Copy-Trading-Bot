// jupiterPriceV2.ts
import axios from 'axios';
import { sleep } from '../../../utils/common.js';
import { elizaLogger } from "@ai16z/eliza";
export class JupiterPriceV2 {
    endpoint = 'https://api.jup.ag/price/v2';
    rateLimitCounter = 0;
    lastRateLimitReset = Date.now();
    RATE_LIMIT = 600;
    RATE_LIMIT_WINDOW = 60000; // 1 minute
    MIN_CONFIDENCE = 0.5;
    MAX_RETRIES = 5;
    BATCH_SIZE = 100;
    async checkRateLimit() {
        const now = Date.now();
        if (now - this.lastRateLimitReset >= this.RATE_LIMIT_WINDOW) {
            this.rateLimitCounter = 0;
            this.lastRateLimitReset = now;
        }
        if (this.rateLimitCounter >= this.RATE_LIMIT) {
            const waitTime = this.RATE_LIMIT_WINDOW - (now - this.lastRateLimitReset);
            await sleep(waitTime);
            this.rateLimitCounter = 0;
            this.lastRateLimitReset = Date.now();
        }
    }
    async getPrices(tokenMints) {
        let attempts = 0;
        while (attempts < this.MAX_RETRIES) {
            try {
                await this.checkRateLimit();
                // Split into batches of 100
                const batches = [];
                for (let i = 0; i < tokenMints.length; i += this.BATCH_SIZE) {
                    batches.push(tokenMints.slice(i, i + this.BATCH_SIZE));
                }
                // Fetch prices for each batch
                const responses = await Promise.all(batches.map(async (batch) => {
                    const tokens = batch.join(',');
                    const response = await axios.get(`${this.endpoint}`, {
                        params: {
                            ids: tokens,
                            showExtraInfo: true
                        }
                    });
                    this.rateLimitCounter++;
                    return response.data;
                }));
                // Merge responses
                const mergedData = responses.reduce((acc, curr) => ({
                    ...acc,
                    data: { ...acc.data, ...curr.data }
                }), { data: {} });
                // Filter and validate prices
                Object.entries(mergedData.data).forEach(([key, value]) => {
                    const data = value;
                    if (!data.extraInfo || data.extraInfo.confidenceLevel === 'low') {
                        elizaLogger.warn(`Low confidence or missing data for token ${key}`);
                        delete mergedData.data[key];
                    }
                });
                return mergedData;
            }
            catch (error) {
                attempts++;
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                elizaLogger.error(`Attempt ${attempts} failed:`, errorMessage);
                if (attempts === this.MAX_RETRIES) {
                    throw new Error(`Failed to fetch prices after ${this.MAX_RETRIES} attempts: ${errorMessage}`);
                }
                await sleep(1000 * Math.pow(2, attempts)); // Exponential backoff
            }
        }
        throw new Error('Failed to fetch prices');
    }
    async getPrice(tokenMint) {
        const response = await this.getPrices([tokenMint]);
        if (!response.data[tokenMint]) {
            throw new Error(`No price data available for token ${tokenMint}`);
        }
        const priceData = response.data[tokenMint];
        // Log successful price fetch with confidence level
        elizaLogger.info('Price fetched successfully', {
            token: tokenMint,
            price: priceData.price,
            confidence: priceData.extraInfo?.confidenceLevel
        });
        return priceData;
    }
    async getMarketDepth(tokenMint) {
        const priceData = await this.getPrice(tokenMint);
        if (!priceData.extraInfo?.depth) {
            throw new Error('No depth data available');
        }
        return {
            buyDepth: priceData.extraInfo.depth.buyPriceImpactRatio.depth,
            sellDepth: priceData.extraInfo.depth.sellPriceImpactRatio.depth
        };
    }
    async calculateVolume(tokenMint) {
        try {
            const priceData = await this.getPrice(tokenMint);
            const depth = await this.getMarketDepth(tokenMint);
            if (!depth) {
                throw new Error('No depth data available for volume calculation');
            }
            const price = parseFloat(priceData.price);
            // Calculate weighted average volume from depth data
            const volumes = Object.keys(depth.buyDepth).map(depthLevel => {
                const amount = parseFloat(depthLevel);
                const buyImpact = depth.buyDepth[depthLevel];
                const sellImpact = depth.sellDepth[depthLevel] || 0;
                const avgImpact = (buyImpact + sellImpact) / 2;
                return amount * price * (1 - avgImpact);
            });
            const totalVolume = volumes.reduce((sum, vol) => sum + vol, 0);
            elizaLogger.info('Volume calculated successfully', {
                token: tokenMint,
                volume: totalVolume
            });
            return totalVolume;
        }
        catch (error) {
            elizaLogger.error('Error calculating volume:', error);
            throw error;
        }
    }
}
