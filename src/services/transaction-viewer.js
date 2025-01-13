import { Connection } from '@solana/web3.js';
import { Logger } from '../utils/logger.js';
import axios from 'axios';
import { redis } from '../infrastructure/database/redis.config.js';
export class TransactionViewer {
    connection;
    logger;
    heliusEndpoint;
    birdeyeEndpoint;
    constructor() {
        this.connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
        this.logger = new Logger('TransactionViewer');
        this.heliusEndpoint = process.env.HELIUS_BASE_URL || 'https://api.helius.xyz';
        this.birdeyeEndpoint = 'https://public-api.birdeye.so';
    }
    async getSwapTransactions(walletAddress, limit = 50) {
        try {
            const cacheKey = `swaps:${walletAddress}:${limit}`;
            const cachedData = await redis.get(cacheKey);
            if (cachedData) {
                return JSON.parse(cachedData);
            }
            const response = await axios.post(`${this.heliusEndpoint}/v0/addresses/${walletAddress}/transactions`, {
                query: {
                    types: ['SWAP'],
                },
                options: {
                    limit,
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.HELIUS_API_KEY}`
                }
            });
            const swaps = response.data.map(this.parseSwapTransaction);
            await redis.setex(cacheKey, 300, JSON.stringify(swaps)); // Cache for 5 minutes
            return swaps;
        }
        catch (error) {
            this.logger.error('Error fetching swap transactions:', error);
            throw error;
        }
    }
    async getTokenInfo(tokenAddress) {
        try {
            const cacheKey = `token:${tokenAddress}`;
            const cachedData = await redis.get(cacheKey);
            if (cachedData) {
                return JSON.parse(cachedData);
            }
            const response = await axios.get(`${this.birdeyeEndpoint}/public/token/${tokenAddress}`, {
                headers: {
                    'x-api-key': process.env.BIRDEYE_API_KEY
                }
            });
            const tokenInfo = {
                address: tokenAddress,
                symbol: response.data.symbol,
                name: response.data.name,
                decimals: response.data.decimals,
                totalSupply: response.data.totalSupply,
                holders: response.data.holders,
                twitter: response.data.twitter,
                website: response.data.website,
                createdAt: response.data.createdAt,
                marketCap: response.data.marketCap,
                price: response.data.price,
                volume24h: response.data.volume24h
            };
            await redis.setex(cacheKey, 300, JSON.stringify(tokenInfo)); // Cache for 5 minutes
            return tokenInfo;
        }
        catch (error) {
            this.logger.error('Error fetching token info:', error);
            throw error;
        }
    }
    async getTwitterContent(tokenSymbol, limit = 10) {
        try {
            const cacheKey = `twitter:${tokenSymbol}:${limit}`;
            const cachedData = await redis.get(cacheKey);
            if (cachedData) {
                return JSON.parse(cachedData);
            }
            const fields = {
                'tweet.fields': 'created_at,public_metrics,entities',
                'user.fields': 'verified,public_metrics'
            };
            const response = await axios.get(`https://api.twitter.com/2/tweets/search/recent`, {
                params: {
                    query: `${tokenSymbol} (is:verified OR has:links)`,
                    max_results: limit,
                    ...fields,
                    expansions: 'author_id'
                },
                headers: {
                    'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
                }
            });
            const tweets = response.data.data.map((tweet) => ({
                id: tweet.id,
                text: tweet.text,
                createdAt: tweet.created_at,
                metrics: tweet.public_metrics,
                author: response.data.includes.users.find((user) => user.id === tweet.author_id)
            }));
            await redis.setex(cacheKey, 300, JSON.stringify(tweets)); // Cache for 5 minutes
            return tweets;
        }
        catch (error) {
            this.logger.error('Error fetching Twitter content:', error);
            throw error;
        }
    }
    parseSwapTransaction(tx) {
        return {
            signature: tx.signature,
            timestamp: tx.timestamp,
            tokenIn: {
                symbol: tx.tokenIn.symbol,
                address: tx.tokenIn.address,
                amount: tx.tokenIn.amount
            },
            tokenOut: {
                symbol: tx.tokenOut.symbol,
                address: tx.tokenOut.address,
                amount: tx.tokenOut.amount
            },
            dex: tx.dex,
            txHash: tx.signature,
            status: tx.status,
            price: tx.price,
            priceImpact: tx.priceImpact
        };
    }
}
