import { TwitterService } from './twitter';
import { DiscordService } from './discord';
import { MarketDataProcessor } from '../market/data/DataProcessor';
import { JupiterPriceV2Service, JupiterService } from '../blockchain/defi/JupiterPriceV2Service';
import { elizaLogger } from "@ai16z/eliza";
import { RedisService as RedisCacheService } from '../../services/market/data/RedisCache';
import { TokenProvider } from '../../providers/token';
import { Connection, PublicKey } from '@solana/web3.js';
import { WalletProvider } from '../../providers/wallet';
export class SocialService {
    twitterService;
    discordService;
    dataProcessor;
    jupiterService;
    constructor(config) {
        if (!config.helius?.apiKey) {
            throw new Error('Helius API key is required');
        }
        // Initialize RedisCacheService
        const redisService = new RedisCacheService({
            host: config.redis?.host || process.env.REDIS_HOST || '',
            port: config.redis?.port || parseInt(process.env.REDIS_PORT || '6379'),
            password: config.redis?.password || process.env.REDIS_PASSWORD || '',
            keyPrefix: 'jupiter-price:',
            enableCircuitBreaker: true
        });
        // Initialize TokenProvider
        const tokenProvider = new TokenProvider('', // Token address will be set per request
        new WalletProvider(new Connection(''), new PublicKey('')), redisService, { apiKey: process.env.API_KEY || '' });
        // Initialize JupiterPriceV2Service
        this.jupiterService = new JupiterPriceV2Service({
            redis: {
                host: config.redis?.host || process.env.REDIS_HOST || '',
                port: config.redis?.port || parseInt(process.env.REDIS_PORT || '6379'),
                password: config.redis?.password || process.env.REDIS_PASSWORD || '',
                keyPrefix: 'jupiter-price:',
                enableCircuitBreaker: true
            },
            rpcConnection: {
                url: process.env.SOLANA_RPC_URL || '',
                walletPublicKey: process.env.SOLANA_PUBLIC_KEY || ''
            }
        }, tokenProvider, redisService, new JupiterService());
        // Initialize data processor with price fetcher
        this.dataProcessor = new MarketDataProcessor(config.helius.apiKey, 'https://tokens.jup.ag/tokens?tags=verified');
        if (config.twitter) {
            this.twitterService = new TwitterService({
                apiKey: config.twitter.apiKey,
                apiSecret: config.twitter.apiSecret,
                accessToken: config.twitter.accessToken,
                accessSecret: config.twitter.accessSecret,
                bearerToken: config.twitter.bearerToken,
                mockMode: config.twitter.mockMode ?? false,
                maxRetries: config.twitter.maxRetries ?? 0,
                retryDelay: config.twitter.retryDelay ?? 0,
                baseUrl: 'https://api.twitter.com', // Add baseUrl
                contentRules: config.twitter.contentRules || { maxEmojis: 0, maxHashtags: 0, minInterval: 0 },
                oauthClientId: config.twitter.oauthClientId,
                oauthClientSecret: config.twitter.oauthClientSecret,
                marketDataConfig: {
                    heliusApiKey: config.helius.apiKey,
                    updateInterval: 0,
                    volatilityThreshold: 0
                },
                tokenAddresses: []
            }, config.services.ai, this.dataProcessor);
        }
        if (config.discord) {
            this.discordService = new DiscordService({
                token: config.discord.token,
                guildId: config.discord.guildId,
                aiService: config.services.ai
            });
        }
    }
    async initialize() {
        try {
            const initPromises = [];
            if (this.twitterService) {
                initPromises.push(this.twitterService.initialize());
            }
            if (this.discordService) {
                // DiscordService auto-initializes in constructor
                initPromises.push(Promise.resolve());
            }
            await Promise.all(initPromises);
            elizaLogger.success('Social services initialized successfully');
        }
        catch (error) {
            elizaLogger.error('Failed to initialize social services:', error);
            throw error;
        }
    }
    async getCommunityMetrics() {
        return {
            followers: 1000,
            engagement: 0.75,
            activity: 'High'
        };
    }
    async send(content) {
        const promises = [];
        if (this.twitterService) {
            try {
                await this.twitterService.tweet(content, { replyToTweetId: undefined });
                promises.push(Promise.resolve());
            }
            catch (error) {
                elizaLogger.error('Failed to send tweet:', error);
                promises.push(Promise.reject(error));
            }
        }
        if (this.discordService) {
            promises.push(this.discordService.sendMessage('System', content));
        }
        await Promise.all(promises);
    }
    async sendMessage(platform, messageId, content) {
        try {
            switch (platform.toLowerCase()) {
                case 'twitter':
                    if (this.twitterService) {
                        await this.twitterService.tweet(content, { replyToTweetId: messageId });
                    }
                    break;
                case 'discord':
                    if (this.discordService) {
                        await this.discordService.sendMessage(messageId, content);
                    }
                    break;
                default:
                    throw new Error(`Unsupported platform: ${platform}`);
            }
        }
        catch (error) {
            elizaLogger.error(`Failed to send message to ${platform}:`, error);
            throw error;
        }
    }
}
export { TwitterService } from './twitter';
export { DiscordService } from './discord';
export default SocialService;
