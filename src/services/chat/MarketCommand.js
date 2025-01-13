import { Connection, PublicKey } from '@solana/web3.js';
import { JupiterPriceV2Service } from '../blockchain/defi/JupiterPriceV2Service';
import { elizaLogger } from "@ai16z/eliza";
import { TokenProvider } from '../../providers/token';
import { RedisService } from '../market/data/RedisCache';
import { JupiterService } from '../blockchain/defi/JupiterPriceV2Service';
import { WalletProvider } from '../../providers/wallet';
export class MarketCommand {
    jupiterService;
    connection;
    constructor(config) {
        this.connection = new Connection(config.rpcUrl);
        if (!process.env.WALLET_PUBLIC_KEY) {
            throw new Error('WALLET_PUBLIC_KEY environment variable is not set');
        }
        const walletProvider = new WalletProvider(this.connection, new PublicKey(process.env.WALLET_PUBLIC_KEY));
        const tokenProvider = new TokenProvider('tokenAddress', walletProvider, new RedisService({
            host: process.env.REDIS_HOST || 'localhost',
            port: Number(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD,
            keyPrefix: 'jupiter-price:',
            enableCircuitBreaker: true
        }), { apiKey: process.env.API_KEY || '' });
        const redisService = new RedisService({
            host: process.env.REDIS_HOST || 'localhost',
            port: Number(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD,
            keyPrefix: 'jupiter-price:',
            enableCircuitBreaker: true
        });
        const jupiterService = new JupiterService();
        this.jupiterService = new JupiterPriceV2Service({
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: Number(process.env.REDIS_PORT) || 6379,
                password: process.env.REDIS_PASSWORD,
                keyPrefix: 'jupiter-price:',
                enableCircuitBreaker: true
            },
            rpcConnection: {
                url: config.rpcUrl,
                walletPublicKey: process.env.WALLET_PUBLIC_KEY
            },
            rateLimitConfig: {
                requestsPerMinute: 600,
                windowMs: 60000
            }
        }, tokenProvider, redisService, jupiterService);
    }
    async execute(args) {
        try {
            if (!args.length) {
                return {
                    success: false,
                    message: 'Please specify a token symbol (e.g., market SOL)'
                };
            }
            const symbol = args[0].toUpperCase();
            const marketData = await this.jupiterService.getMarketMetrics(symbol);
            return {
                success: true,
                data: marketData,
                message: this.formatMarketData(symbol, marketData)
            };
        }
        catch (error) {
            elizaLogger.error('Market command error:', error);
            return {
                success: false,
                message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    async analyze(args) {
        try {
            const symbol = args[0]?.toUpperCase();
            if (!symbol) {
                return {
                    success: false,
                    message: 'Please specify a token to analyze'
                };
            }
            const metrics = await this.jupiterService.getMarketMetrics(symbol);
            return {
                success: true,
                data: metrics,
                message: this.formatAnalysis(symbol, metrics)
            };
        }
        catch (error) {
            elizaLogger.error('Analysis error:', error);
            return {
                success: false,
                message: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    async generateMarketTweet(args) {
        try {
            const symbol = args[0]?.toUpperCase();
            if (!symbol) {
                return {
                    success: false,
                    message: 'Please specify a token for the tweet'
                };
            }
            const metrics = await this.jupiterService.getMarketMetrics(symbol);
            const tweet = this.formatTweetContent(symbol, metrics);
            return {
                success: true,
                data: { tweet, metrics },
                message: tweet
            };
        }
        catch (error) {
            elizaLogger.error('Tweet generation error:', error);
            return {
                success: false,
                message: `Tweet generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    formatMarketData(symbol, data) {
        return `
${symbol} Market Data:
Price: $${data.price.toFixed(4)}
24h Change: ${data.priceChange24h.toFixed(2)}%
Volume: $${data.volume24h.toLocaleString()}
Market Cap: $${data.marketCap.toLocaleString()}
Confidence: ${data.confidenceLevel}
`;
    }
    formatAnalysis(symbol, metrics) {
        return `
${symbol} Market Analysis:
Current Price: $${metrics.price.toFixed(4)}
24h Performance: ${metrics.priceChange24h > 0 ? '📈' : '📉'} ${metrics.priceChange24h.toFixed(2)}%
Volume Analysis: ${this.analyzeVolume(metrics.volume24h)}
Market Cap Rank: ${this.analyzeMarketCap(metrics.marketCap)}
Confidence Level: ${metrics.confidenceLevel.toUpperCase()}
`;
    }
    formatTweetContent(symbol, metrics) {
        return `
${symbol} Market Update 🚀
💰 Price: $${metrics.price.toFixed(4)}
📊 24h: ${metrics.priceChange24h > 0 ? '↗️' : '↘️'} ${metrics.priceChange24h.toFixed(2)}%
📈 Vol: $${(metrics.volume24h / 1000000).toFixed(2)}M
#${symbol} #Crypto
`;
    }
    analyzeVolume(volume) {
        if (volume > 1000000)
            return 'High 🔥';
        if (volume > 100000)
            return 'Moderate 📊';
        return 'Low 📉';
    }
    analyzeMarketCap(marketCap) {
        if (marketCap > 1000000000)
            return 'Large Cap 🔵';
        if (marketCap > 100000000)
            return 'Mid Cap 🟡';
        return 'Small Cap 🟢';
    }
}
