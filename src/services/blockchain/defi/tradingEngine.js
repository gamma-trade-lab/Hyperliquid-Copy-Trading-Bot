// src/services/blockchain/defi/tradingEngine.ts
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { SwapMode } from '@jup-ag/core';
import { EventEmitter } from 'events';
import JSBI from 'jsbi';
import axios from 'axios';
import { VolatilityManager } from '../../market/volatility/VolatilityManager.js';
import { MarketDataProcessor } from '../../market/data/DataProcessor';
import { SentimentSource } from '../../market/signals/marketSentiment.js';
import { retry } from '../../../utils/common.js';
import { JupiterPriceV2 } from './jupiterPriceV2.js';
import { AMMHealthChecker } from './ammHealth.js';
export class TradingEngine extends EventEmitter {
    connection;
    jupiter;
    config;
    strategies;
    tradeHistory;
    MAX_HISTORY = 1000;
    volatilityManager;
    dataProcessor;
    wallet;
    MIN_PROFIT_THRESHOLD = 0.005; // 0.5% minimum profit threshold
    DEX_ENDPOINTS = {
        JUPITER: 'https://quote-api.jup.ag/v6',
        JUPITER_PRICE: 'https://price.jup.ag/v2',
        ORCA: 'https://api.orca.so',
        RAYDIUM: 'https://api.raydium.io/v2'
    };
    sentimentAnalyzer;
    openPositions = new Map();
    DEFAULT_STOP_LOSS = 0.05; // 5% default stop loss
    MAX_POSITION_SIZE = 0.1; // 10% of total portfolio
    jupiterPriceV2;
    ammHealthChecker;
    constructor(connection, jupiter, config, sentimentAnalyzer, wallet) {
        super();
        this.connection = connection;
        this.jupiter = jupiter;
        this.config = config;
        this.wallet = wallet;
        this.strategies = new Map();
        this.tradeHistory = new Map();
        // Initialize with default trading strategy
        const defaultStrategy = {
            id: 'default',
            name: 'Default Strategy',
            tokens: [],
            rules: [],
            config: this.config,
            status: 'active'
        };
        this.strategies.set(defaultStrategy.id, defaultStrategy);
        const heliusApiKey = process.env.HELIUS_API_KEY; // Use API key from .env
        this.dataProcessor = new MarketDataProcessor(heliusApiKey, 'https://tokens.jup.ag/tokens?tags=verified');
        this.volatilityManager = new VolatilityManager(this.dataProcessor);
        this.sentimentAnalyzer = sentimentAnalyzer;
        this.jupiterPriceV2 = new JupiterPriceV2();
        this.ammHealthChecker = new AMMHealthChecker();
    }
    async executeTrade(params) {
        try {
            // Validate trade parameters
            this.validateTradeParams(params);
            // Check market sentiment
            const analysis = await this.sentimentAnalyzer.analyzeSentiment({
                sources: [SentimentSource.TRADING, SentimentSource.SOCIAL, SentimentSource.NEWS],
                confidenceThreshold: 0.6,
                timeRange: {
                    start: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
                    end: Date.now()
                }
            });
            const sentiment = analysis.overall;
            // Adjust trade amount based on sentiment
            if (sentiment < -0.5) {
                console.log('Negative market sentiment detected, reducing position size');
                params.amount *= 0.5;
            }
            else if (sentiment > 0.5) {
                console.log('Positive market sentiment detected, maintaining position size');
            }
            // Get best route
            const route = await this.findBestRoute(params);
            if (!route) {
                throw new Error('No valid route found');
            }
            // Check if route meets constraints
            this.validateRoute(route);
            // Execute trade
            const result = await this.executeRoute(route);
            // Store trade result
            this.addToHistory(result);
            this.emit('tradeExecuted', result);
            return result;
        }
        catch (error) {
            console.error('Error executing trade:', error);
            throw error;
        }
    }
    validateTradeParams(params) {
        if (!params.inputToken || !params.outputToken) {
            throw new Error('Invalid tokens');
        }
        if (params.amount <= 0) {
            throw new Error('Invalid amount');
        }
        if (params.type === 'limit' && !params.limitPrice) {
            throw new Error('Limit price required for limit order');
        }
    }
    async findBestRoute(params) {
        try {
            if (!params || !params.inputToken || !params.outputToken) {
                return null;
            }
            // Get price data with confidence check and retry mechanism
            // Get price data with confidence check and retry mechanism
            // Validate prices through Jupiter Price V2 service
            const [inputPrice, outputPrice] = await Promise.all([
                retry(() => this.jupiterPriceV2.getPrice(params.inputToken)),
                retry(() => this.jupiterPriceV2.getPrice(params.outputToken))
            ]);
            if (!inputPrice || !outputPrice) {
                console.error('Failed to fetch price data');
                return null;
            }
            // Calculate base amount with price
            const baseAmount = params.amount * Number(inputPrice);
            // Adjust position size based on volatility and price confidence
            const adjustedAmount = await this.volatilityManager.adjustPosition(baseAmount, params.inputToken);
            // Get AMM health status
            const ammHealth = await this.ammHealthChecker.checkHealth([params.inputToken, params.outputToken]);
            const excludeDexes = Object.entries(ammHealth)
                .filter(([_, health]) => health < 0.8)
                .map(([dex]) => dex);
            try {
                const computedRoutes = await this.jupiter.computeRoutes({
                    inputMint: new PublicKey(params.inputToken),
                    outputMint: new PublicKey(params.outputToken),
                    amount: JSBI.BigInt(adjustedAmount),
                    slippageBps: params.slippageBps || this.config.maxSlippage,
                    onlyDirectRoutes: false,
                    filterTopNResult: 3,
                    swapMode: SwapMode.ExactIn
                });
                if (!computedRoutes.routesInfos.length) {
                    console.error('No routes found with current constraints');
                    return null;
                }
                // Return the best route based on output amount
                return computedRoutes.routesInfos[0];
            }
            catch (error) {
                console.error('Error computing routes:', error);
                return null;
            }
        }
        catch (error) {
            console.error('Error finding best route:', error);
            return null;
        }
    }
    /**
     * Detect arbitrage opportunities across DEXes
     */
    async detectArbitrage(tokenA, tokenB) {
        try {
            const amount = BigInt(1000000); // Base amount for comparison
            // Get quotes from different DEXes
            const [jupiterRoute, orcaRoute, raydiumRoute] = await Promise.all([
                this.findBestRoute({ inputToken: tokenA, outputToken: tokenB, amount: Number(amount) }),
                this.getOrcaQuote(tokenA, tokenB, amount),
                this.getRaydiumQuote(tokenA, tokenB, amount)
            ]);
            // Compare routes to find arbitrage opportunities
            const routes = [
                { dex: 'Jupiter', route: jupiterRoute },
                { dex: 'Orca', route: orcaRoute },
                { dex: 'Raydium', route: raydiumRoute }
            ].filter(r => r.route !== null);
            if (routes.length < 2)
                return; // Need at least 2 DEXes for arbitrage
            // Find best buy and sell prices
            const bestBuy = routes.reduce((min, curr) => {
                if (!curr.route || !min.route)
                    return min;
                return curr.route.outAmount < min.route.outAmount ? curr : min;
            });
            const bestSell = routes.reduce((max, curr) => {
                if (!curr.route || !max.route)
                    return max;
                return curr.route.outAmount > max.route.outAmount ? curr : max;
            });
            // Calculate potential profit
            const profitRatio = bestBuy.route && bestSell.route
                ? JSBI.toNumber(bestSell.route.outAmount) / JSBI.toNumber(bestBuy.route.outAmount)
                : 0;
            if (profitRatio > 1 + this.MIN_PROFIT_THRESHOLD) {
                // Emit arbitrage opportunity event
                this.emit('arbitrageDetected', {
                    buyDex: bestBuy.dex,
                    sellDex: bestSell.dex,
                    tokenA,
                    tokenB,
                    profitRatio,
                    timestamp: Date.now()
                });
            }
        }
        catch (error) {
            console.error('Error detecting arbitrage:', error);
        }
    }
    /**
     * Get quote from Orca DEX
     */
    async getOrcaQuote(tokenA, tokenB, amount) {
        try {
            const response = await axios.get(`${this.DEX_ENDPOINTS.ORCA}/quote`, {
                params: {
                    inputMint: tokenA,
                    outputMint: tokenB,
                    amount: amount.toString(),
                    slippage: this.config.maxSlippage
                }
            });
            return response.data;
        }
        catch (error) {
            console.error('Error getting Orca quote:', error);
            return null;
        }
    }
    /**
     * Get quote from Raydium DEX
     */
    async getRaydiumQuote(tokenA, tokenB, amount) {
        try {
            const response = await axios.get(`${this.DEX_ENDPOINTS.RAYDIUM}/quote`, {
                params: {
                    inputMint: tokenA,
                    outputMint: tokenB,
                    amount: amount.toString(),
                    slippage: this.config.maxSlippage
                }
            });
            return response.data;
        }
        catch (error) {
            console.error('Error getting Raydium quote:', error);
            return null;
        }
    }
    validateRoute(route) {
        // Implement route validation logic
    }
    async executeRoute(route) {
        try {
            // Execute the trade using Jupiter SDK
            let txid;
            try {
                const { swapTransaction } = await this.jupiter.exchange({
                    routeInfo: route,
                    userPublicKey: this.wallet.publicKey
                });
                // Send transaction using Solana connection
                let transaction;
                if (swapTransaction instanceof VersionedTransaction) {
                    // Convert VersionedTransaction to legacy Transaction if needed
                    const serializedMessage = swapTransaction.message.serialize();
                    transaction = Transaction.from(serializedMessage);
                }
                else {
                    transaction = swapTransaction;
                }
                // Sign and send transaction
                transaction.feePayer = this.wallet.publicKey;
                transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
                txid = await this.connection.sendTransaction(transaction, [this.wallet], { skipPreflight: false });
                // Wait for confirmation
                const confirmation = await this.connection.confirmTransaction(txid, 'confirmed');
                if (confirmation.value.err) {
                    throw new Error(`Transaction failed: ${confirmation.value.err}`);
                }
                console.log(`Trade executed successfully: ${txid}`);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error('Failed to execute trade:', errorMessage);
                throw new Error(`Trade execution failed: ${errorMessage}`);
            }
            const inputAmount = JSBI.toNumber(route.inAmount);
            const outputAmount = JSBI.toNumber(route.outAmount);
            const inputToken = route.marketInfos[0].inputMint.toBase58();
            const outputToken = route.marketInfos[route.marketInfos.length - 1].outputMint.toBase58();
            const executionPrice = outputAmount / inputAmount;
            // Create trade result
            const result = {
                id: txid,
                inputToken,
                outputToken,
                inputAmount,
                outputAmount,
                executionPrice,
                slippage: route.slippageBps ? route.slippageBps / 10000 : 0,
                priceImpact: route.priceImpactPct || 0,
                fee: route.marketInfos.reduce((acc, info) => Number(acc) + Number(info.lpFee?.amount || 0n) + Number(info.platformFee?.amount || 0n), 0),
                route: route.marketInfos.map((info) => info.label),
                timestamp: Date.now()
            };
            // Update position tracking
            const position = {
                id: txid,
                token: outputToken,
                entryPrice: executionPrice,
                currentPrice: executionPrice,
                size: outputAmount,
                stopLossPrice: executionPrice * (1 - this.DEFAULT_STOP_LOSS),
                stopLossThreshold: this.DEFAULT_STOP_LOSS,
                timestamp: Date.now(),
                lastUpdate: Date.now()
            };
            this.openPositions.set(position.id, position);
            // Run risk management checks
            await this.handleRiskManagement();
            return result;
        }
        catch (error) {
            console.error('Error executing trade:', error);
            throw error;
        }
    }
    async handleRiskManagement() {
        for (const [id, position] of this.openPositions.entries()) {
            try {
                // Get latest volatility metrics
                const volatility = await this.volatilityManager.getVolatilityMetrics(position.token);
                // Adjust stop loss based on volatility
                const adjustedStopLoss = this.DEFAULT_STOP_LOSS * (1 + volatility.adjustmentFactor);
                // Update position price
                const currentPrice = await this.dataProcessor.getTokenPrice(position.token);
                position.currentPrice = currentPrice;
                position.lastUpdate = Date.now();
                // Calculate unrealized loss
                const loss = (position.currentPrice - position.entryPrice) / position.entryPrice;
                // Execute stop loss if threshold breached
                if (Math.abs(loss) >= adjustedStopLoss) {
                    console.log(`Executing stop loss for position ${id} at ${loss * 100}% loss`);
                    await this.executeTrade({
                        inputToken: position.token,
                        outputToken: 'USDC',
                        amount: position.size,
                        type: 'market'
                    });
                    this.openPositions.delete(id);
                    // Emit stop loss event
                    this.emit('stopLossTriggered', {
                        positionId: id,
                        token: position.token,
                        loss: loss * 100,
                        timestamp: Date.now()
                    });
                }
            }
            catch (error) {
                console.error(`Error in risk management for position ${id}:`, error);
            }
        }
    }
    addToHistory(result) {
        if (this.tradeHistory.size >= this.MAX_HISTORY) {
            const oldestKey = this.tradeHistory.keys().next().value;
            if (oldestKey) {
                this.tradeHistory.delete(oldestKey);
            }
        }
        this.tradeHistory.set(result.id, result);
    }
}
