// services/market/data/DataProcessor.ts
import { HeliusService } from '../../blockchain/heliusIntegration';
import { JupiterPriceV2Service, JupiterService } from '../../blockchain/defi/JupiterPriceV2Service';
import { JupiterPriceV2 } from '../../blockchain/defi/jupiterPriceV2';
import Redis from 'ioredis';
import { elizaLogger } from "@ai16z/eliza";
import * as zlib from 'zlib';
import { promisify } from 'util';
import { TokenProvider } from '../../../providers/token';
import { WalletProvider } from '../../../providers/wallet';
import { Connection, PublicKey } from '@solana/web3.js';
import { RedisService } from './RedisCache';
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
export class MarketDataProcessor {
    redis;
    heliusService;
    jupiterService;
    jupiterV2;
    CACHE_PREFIX = 'market:';
    DEFAULT_CACHE_TTL = 60; // 1 minute
    ERROR_THRESHOLD = 5;
    CIRCUIT_TIMEOUT = 60000; // 1 minute
    errorCount = 0;
    circuitOpen = false;
    lastError = 0;
    constructor(heliusApiKey, jupiterPriceUrl) {
        // Configure Redis to use TCP connection
        this.redis = new Redis({
            host: '127.0.0.1', // Using IP instead of localhost
            port: 6379,
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                elizaLogger.info(`Retrying Redis connection in ${delay}ms... (attempt ${times})`);
                return delay;
            },
            enableOfflineQueue: true,
            showFriendlyErrorStack: true
        });
        this.heliusService = new HeliusService(heliusApiKey);
        this.jupiterService = new JupiterPriceV2Service({
            redis: {
                host: '127.0.0.1',
                port: 6379
            }
        }, new TokenProvider('', new WalletProvider(new Connection('https://api.mainnet-beta.solana.com'), new PublicKey('')), new RedisService({
            host: '127.0.0.1',
            port: 6379
        }), { apiKey: '' }), new RedisService({
            host: '127.0.0.1',
            port: 6379
        }), new JupiterService());
        this.jupiterV2 = new JupiterPriceV2();
        this.setupRedisHandlers();
    }
    setupRedisHandlers() {
        this.redis.on('error', (error) => {
            elizaLogger.error('Redis error:', {
                message: error.message,
                stack: error.stack
            });
            this.handleError(error);
        });
        this.redis.on('ready', () => {
            elizaLogger.info('Redis connection established');
        });
        this.redis.on('connect', () => {
            elizaLogger.info('Redis client connected');
        });
        this.redis.on('reconnecting', () => {
            elizaLogger.info('Redis client reconnecting');
        });
    }
    async compressData(data) {
        const jsonString = JSON.stringify(data);
        const compressed = await gzip(jsonString);
        return compressed.toString('base64');
    }
    async decompressData(data) {
        const buffer = Buffer.from(data, 'base64');
        const decompressed = await gunzip(buffer);
        return JSON.parse(decompressed.toString());
    }
    handleError(error) {
        this.errorCount++;
        this.lastError = Date.now();
        if (this.errorCount >= this.ERROR_THRESHOLD) {
            this.circuitOpen = true;
            elizaLogger.warn('Circuit breaker opened', {
                errors: this.errorCount,
                lastError: error.message
            });
            setTimeout(() => {
                this.circuitOpen = false;
                this.errorCount = 0;
                elizaLogger.info('Circuit breaker reset');
            }, this.CIRCUIT_TIMEOUT);
        }
    }
    async getMarketData(tokenAddress) {
        const cacheKey = `${this.CACHE_PREFIX}${tokenAddress}`;
        try {
            // Try cache first
            const cached = await this.redis.get(cacheKey);
            if (cached && !this.circuitOpen) {
                return await this.decompressData(cached);
            }
            // Get data from Jupiter
            const [priceData, extraInfo] = await Promise.all([
                this.jupiterService.getTokenPrice(tokenAddress),
                this.jupiterV2.getPrices([tokenAddress])
            ]);
            // Get holder data from Helius
            const mintInfo = await this.heliusService.getMintAccountInfo(tokenAddress);
            if (mintInfo) {
                mintInfo.supply = BigInt(mintInfo.supply);
            }
            if (!mintInfo || !mintInfo.supply || !mintInfo.decimals) {
                throw new Error('Failed to fetch mint info');
            }
            const holders = await this.heliusService.getHoldersClassification(tokenAddress);
            if (!holders || !holders.topHolders) {
                throw new Error('Failed to fetch holders classification');
            }
            // Calculate market metrics
            if (!priceData) {
                throw new Error('Failed to fetch price data');
            }
            const price = Number(priceData.price);
            const marketData = {
                price,
                volume24h: extraInfo?.data[tokenAddress]?.volume24h || 0,
                priceChange24h: this.calculatePriceChange(priceData),
                volatility: await this.calculateVolatility(tokenAddress),
                marketCap: price * Number(mintInfo.supply) / (10 ** mintInfo.decimals),
                holders: {
                    total: holders.totalHolders,
                    top: holders.topHolders.map(holder => ({
                        address: holder.owner,
                        balance: holder.balance,
                        percentage: (holder.balance / holders.totalSupply) * 100
                    }))
                },
                lastUpdate: Date.now(),
                onChainActivity: {
                    transactions: 0,
                    swaps: 0,
                    uniqueTraders: 0
                },
                topHolders: []
            };
            // Cache the result
            await this.redis.set(cacheKey, await this.compressData(marketData), 'EX', this.DEFAULT_CACHE_TTL);
            this.errorCount = 0;
            return marketData;
        }
        catch (error) {
            elizaLogger.error('Error fetching market data:', error);
            this.handleError(error instanceof Error ? error : new Error(String(error)));
            // Return cached data if available
            const cached = await this.redis.get(cacheKey);
            if (cached) {
                return await this.decompressData(cached);
            }
            throw error;
        }
    }
    async getTokenPrice(tokenAddress) {
        const marketData = await this.getMarketData(tokenAddress);
        return marketData.price;
    }
    async getHistoricalPrices(token, window) {
        // Implement the logic to fetch historical prices for the given token and window
        // This is a placeholder implementation
        return [];
    }
    async getAverageVolatility(token) {
        const window = 30; // Example window size of 30 days
        return await this.calculateAverageVolatility(token, window);
    }
    async calculateAverageVolatility(tokenAddress, window) {
        const historicalPrices = await this.getHistoricalPrices(tokenAddress, window);
        if (historicalPrices.length < 2)
            return 0;
        let sumVolatility = 0;
        for (let i = 1; i < historicalPrices.length; i++) {
            const priceChange = Math.abs(historicalPrices[i].price - historicalPrices[i - 1].price);
            const volatility = priceChange / historicalPrices[i - 1].price;
            sumVolatility += volatility;
        }
        return sumVolatility / (historicalPrices.length - 1);
    }
    calculatePriceChange(priceData) {
        if (!priceData.extraInfo?.lastSwappedPrice)
            return 0;
        const currentPrice = Number(priceData.price);
        const lastPrice = Number(priceData.extraInfo.lastSwappedPrice.lastJupiterSellPrice);
        return ((currentPrice - lastPrice) / lastPrice) * 100;
    }
    async calculateVolatility(tokenAddress) {
        const cacheKey = `${this.CACHE_PREFIX}volatility:${tokenAddress}`;
        try {
            const prices = await this.jupiterService.getTokenPrice(tokenAddress);
            if (!prices || !prices.extraInfo?.depth)
                return 0;
            const { buyPriceImpactRatio, sellPriceImpactRatio } = prices.extraInfo.depth;
            // Calculate volatility using price impact ratios
            const avgImpact = (Object.values(buyPriceImpactRatio.depth).reduce((a, b) => a + b, 0) +
                Object.values(sellPriceImpactRatio.depth).reduce((a, b) => a + b, 0)) / (Object.keys(buyPriceImpactRatio.depth).length +
                Object.keys(sellPriceImpactRatio.depth).length);
            await this.redis.set(cacheKey, await this.compressData({ volatility: avgImpact }), 'EX', this.DEFAULT_CACHE_TTL * 5 // Cache volatility longer
            );
            return avgImpact;
        }
        catch (error) {
            elizaLogger.error('Error calculating volatility:', error);
            const cached = await this.redis.get(cacheKey);
            if (cached) {
                const { volatility } = await this.decompressData(cached);
                return volatility;
            }
            return 0;
        }
    }
    async formatForAI(tokenAddress) {
        try {
            const marketData = await this.getMarketData(tokenAddress);
            return JSON.stringify({
                price: marketData.price.toFixed(6),
                volume24h: this.formatNumber(marketData.volume24h),
                priceChange24h: `${marketData.priceChange24h.toFixed(2)}%`,
                marketCap: this.formatNumber(marketData.marketCap || 0),
                holders: marketData.holders?.total || 0,
                topHolders: marketData.holders?.top.length || 0,
                volatility: marketData.volatility.toFixed(4),
                lastUpdate: new Date(marketData.lastUpdate).toISOString()
            });
        }
        catch (error) {
            elizaLogger.error('Error formatting data for AI:', error);
            throw error;
        }
    }
    formatNumber(num) {
        if (num >= 1e9)
            return `${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6)
            return `${(num / 1e6).toFixed(2)}M`;
        if (num >= 1e3)
            return `${(num / 1e3).toFixed(2)}K`;
        return num.toFixed(2);
    }
    async disconnect() {
        await this.redis.quit();
        elizaLogger.info('Market data processor disconnected');
    }
}
