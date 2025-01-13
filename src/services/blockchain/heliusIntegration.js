// src/services/blockchain/heliusIntegration.ts
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { elizaLogger } from "@ai16z/eliza";
import redisClient from '../../config/inMemoryDB.js';
export class HeliusService {
    getMintAccountInfo(tokenAddress) {
        // Implementation to fetch mint account info
        // Ensure it returns an object of type MintInfo or null
        throw new Error('Method not implemented.');
    }
    getHoldersClassification(tokenAddress) {
        // Implementation to fetch holders classification
        // Ensure it returns an object of type HolderInfo or null
        throw new Error('Method not implemented.');
    }
    apiKey;
    baseUrl;
    connection;
    static CACHE_TTL = 60; // 1 minute
    static MAX_RETRIES = 3;
    static RATE_LIMIT = {
        requests: 0,
        lastReset: Date.now(),
        limit: 600, // 600 requests per minute
        interval: 60000, // 1 minute
    };
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = `https://mainnet.helius-rpc.com/?api-key=${this.apiKey}`;
        this.connection = new Connection(this.baseUrl);
    }
    async checkHealth() {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            if (!response.ok) {
                throw new Error(`Health check failed: ${response.statusText}`);
            }
            const status = await response.text();
            if (status === 'ok') {
                return { status: 'ok' };
            }
            const behindMatch = status.match(/behind \{ distance: (\d+) \}/);
            if (behindMatch) {
                return { status: 'behind', distance: parseInt(behindMatch[1]) };
            }
            return { status: 'unknown' };
        }
        catch (error) {
            elizaLogger.error('Health check failed:', error);
            throw error;
        }
    }
    async checkRateLimit() {
        const now = Date.now();
        const { requests, lastReset, limit, interval } = HeliusService.RATE_LIMIT;
        if (now - lastReset >= interval) {
            HeliusService.RATE_LIMIT.requests = 0;
            HeliusService.RATE_LIMIT.lastReset = now;
            return;
        }
        if (requests >= limit) {
            const waitTime = interval - (now - lastReset);
            elizaLogger.warn(`Rate limit reached, waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            HeliusService.RATE_LIMIT.requests = 0;
            HeliusService.RATE_LIMIT.lastReset = Date.now();
        }
        HeliusService.RATE_LIMIT.requests++;
    }
    async makeRequest(method, params, options = {}) {
        const cacheKey = `helius:${method}:${JSON.stringify(params)}:${JSON.stringify(options)}`;
        // Try cache first
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
        await this.checkRateLimit();
        let lastError = null;
        for (let attempt = 0; attempt < HeliusService.MAX_RETRIES; attempt++) {
            try {
                const response = await fetch(this.baseUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: `${Date.now()}-${Math.random()}`,
                        method,
                        params: [...params, { commitment: options.commitment || 'finalized', ...options }],
                    }),
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                if (data.error) {
                    throw new Error(`Helius API error: ${data.error.message || JSON.stringify(data.error)}`);
                }
                // Cache successful response
                await redisClient.set(cacheKey, JSON.stringify(data.result), 'EX', HeliusService.CACHE_TTL);
                return data.result;
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown error');
                elizaLogger.warn(`Attempt ${attempt + 1} failed:`, lastError.message);
                if (attempt < HeliusService.MAX_RETRIES - 1) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
            }
        }
        throw lastError || new Error('Request failed after all retries');
    }
    async getBalance(address) {
        const result = await this.makeRequest('getBalance', [address]);
        return result.value / LAMPORTS_PER_SOL;
    }
    async getAccountInfo(address, options = {}) {
        return this.makeRequest('getAccountInfo', [address], options);
    }
    async getTransactions(address, options = {}) {
        const transactions = await this.makeRequest('getSignaturesForAddress', [
            address,
            {
                limit: options.limit || 100,
                before: options.before,
                until: options.until,
            },
        ]);
        // Validate response
        if (!Array.isArray(transactions)) {
            throw new Error('Invalid response format from Helius API');
        }
        return transactions;
    }
    async getAssetsByOwner(ownerAddress) {
        return this.makeRequest('getAssetsByOwner', [ownerAddress, { page: 1, limit: 100 }]);
    }
    async getParsedTransaction(signature) {
        return this.makeRequest('getTransaction', [signature], {
            encoding: 'jsonParsed',
            maxSupportedTransactionVersion: 0
        });
    }
    async isHealthy() {
        const health = await this.checkHealth();
        return health.status === 'ok' || (health.status === 'behind' && (health.distance || 0) < 100);
    }
}
