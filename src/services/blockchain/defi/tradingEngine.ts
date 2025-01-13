// src/services/blockchain/defi/tradingEngine.ts

import { Connection, PublicKey, Transaction, Keypair, VersionedTransaction } from '@solana/web3.js';
import { Jupiter, RouteInfo, SwapMode } from '@jup-ag/core';
import { EventEmitter } from 'events';
import JSBI from 'jsbi';
import axios from 'axios';
import { VolatilityManager } from '../../market/volatility/VolatilityManager.js';
import { MarketDataProcessor } from '../../market/data/DataProcessor';
import { MarketSentimentAnalyzer, SentimentSource } from '../../market/signals/marketSentiment.js';
import { retry } from '../../../utils/common.js';
import { JupiterPriceV2 } from './jupiterPriceV2.js';
import { AMMHealthChecker } from './ammHealth.js';

interface TradeConfig {
  maxSlippage: number;
  maxPriceImpact: number;
  minLiquidity: number;
  retryAttempts: number;
  useJitoBundles: boolean;
}

interface TradeParams {
  inputToken: string;
  outputToken: string;
  amount: number;
  type?: 'market' | 'limit';
  limitPrice?: number;
  slippageBps?: number;
  deadline?: number;
}

interface Position {
  id: string;
  token: string;
  entryPrice: number;
  currentPrice: number;
  size: number;
  stopLossPrice: number;
  stopLossThreshold: number;
  timestamp: number;
  lastUpdate: number;
}

interface TradeResult {
  id: string;
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  outputAmount: number;
  executionPrice: number;
  slippage: number;
  priceImpact: number;
  fee: number;
  route: string[];
  timestamp: number;
}

export interface TradingStrategy {
  id: string;
  name: string;
  tokens: string[];
  rules: TradeRule[];
  config: TradeConfig;
  status: 'active' | 'paused';
}

interface TradeRule {
  condition: {
    type: 'price' | 'volume' | 'momentum' | 'signal';
    operator: '>' | '<' | '==' | 'between';
    value: number | [number, number];
  };
  action: {
    type: 'buy' | 'sell';
    amount: number | 'all';
    urgency: 'low' | 'medium' | 'high';
  };
  priority: number;
}

export class TradingEngine extends EventEmitter {
  private connection: Connection;
  private jupiter: Jupiter;
  private config: TradeConfig;
  private readonly strategies: Map<string, TradingStrategy>;
  private tradeHistory: Map<string, TradeResult>;
  private readonly MAX_HISTORY = 1000;
  private volatilityManager: VolatilityManager;
  private dataProcessor: MarketDataProcessor;
  private wallet: Keypair;
  private readonly MIN_PROFIT_THRESHOLD = 0.005; // 0.5% minimum profit threshold
  private readonly DEX_ENDPOINTS = {
    JUPITER: 'https://quote-api.jup.ag/v6',
    JUPITER_PRICE: 'https://price.jup.ag/v2',
    ORCA: 'https://api.orca.so',
    RAYDIUM: 'https://api.raydium.io/v2'
  };
  private sentimentAnalyzer: MarketSentimentAnalyzer;
  private openPositions: Map<string, Position> = new Map();
  private readonly DEFAULT_STOP_LOSS = 0.05; // 5% default stop loss
  private readonly MAX_POSITION_SIZE = 0.1; // 10% of total portfolio
  private readonly jupiterPriceV2: JupiterPriceV2;
  private readonly ammHealthChecker: AMMHealthChecker;

  constructor(
    connection: Connection,
    jupiter: Jupiter,
    config: TradeConfig,
    sentimentAnalyzer: MarketSentimentAnalyzer,
    wallet: Keypair
  ) {
    super();
    this.connection = connection;
    this.jupiter = jupiter;
    this.config = config;
    this.wallet = wallet;
    this.strategies = new Map<string, TradingStrategy>();
    this.tradeHistory = new Map();
    
    // Initialize with default trading strategy
    const defaultStrategy: TradingStrategy = {
      id: 'default',
      name: 'Default Strategy',
      tokens: [],
      rules: [],
      config: this.config,
      status: 'active'
    };
    this.strategies.set(defaultStrategy.id, defaultStrategy);
    const heliusApiKey = process.env.HELIUS_API_KEY!; // Use API key from .env
    this.dataProcessor = new MarketDataProcessor(heliusApiKey, 'https://tokens.jup.ag/tokens?tags=verified');
    this.volatilityManager = new VolatilityManager(this.dataProcessor);
    this.sentimentAnalyzer = sentimentAnalyzer;
    this.jupiterPriceV2 = new JupiterPriceV2();
    this.ammHealthChecker = new AMMHealthChecker();
  }

  public async executeTrade(params: TradeParams): Promise<TradeResult> {
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
      } else if (sentiment > 0.5) {
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
    } catch (error) {
      console.error('Error executing trade:', error);
      throw error;
    }
  }

  private validateTradeParams(params: TradeParams): void {
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

  private async findBestRoute(params: TradeParams): Promise<RouteInfo | null> {
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
      const adjustedAmount = await this.volatilityManager.adjustPosition(
        baseAmount,
        params.inputToken
      );

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
      } catch (error) {
        console.error('Error computing routes:', error);
        return null;
      }
    } catch (error) {
      console.error('Error finding best route:', error);
      return null;
    }
  }

  /**
   * Detect arbitrage opportunities across DEXes
   */
  public async detectArbitrage(tokenA: string, tokenB: string): Promise<void> {
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

      if (routes.length < 2) return; // Need at least 2 DEXes for arbitrage

      // Find best buy and sell prices
      const bestBuy = routes.reduce((min, curr) => {
        if (!curr.route || !min.route) return min;
        return curr.route.outAmount < min.route.outAmount ? curr : min;
      });
      const bestSell = routes.reduce((max, curr) => {
        if (!curr.route || !max.route) return max;
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
    } catch (error) {
      console.error('Error detecting arbitrage:', error);
    }
  }

  /**
   * Get quote from Orca DEX
   */
  private async getOrcaQuote(tokenA: string, tokenB: string, amount: bigint): Promise<RouteInfo | null> {
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
    } catch (error) {
      console.error('Error getting Orca quote:', error);
      return null;
    }
  }

  /**
   * Get quote from Raydium DEX
   */
  private async getRaydiumQuote(tokenA: string, tokenB: string, amount: bigint): Promise<RouteInfo | null> {
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
    } catch (error) {
      console.error('Error getting Raydium quote:', error);
      return null;
    }
  }

  private validateRoute(route: RouteInfo): void {
    // Implement route validation logic
  }

  private async executeRoute(route: RouteInfo): Promise<TradeResult> {
    try {
      // Execute the trade using Jupiter SDK
      let txid: string;
      try {
        const { swapTransaction } = await this.jupiter.exchange({
          routeInfo: route,
          userPublicKey: this.wallet.publicKey
        });
        
        // Send transaction using Solana connection
        let transaction: Transaction;
        if (swapTransaction instanceof VersionedTransaction) {
          // Convert VersionedTransaction to legacy Transaction if needed
          const serializedMessage = swapTransaction.message.serialize();
          transaction = Transaction.from(serializedMessage);
        } else {
          transaction = swapTransaction as Transaction;
        }
        
        // Sign and send transaction
        transaction.feePayer = this.wallet.publicKey;
        transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
        
        txid = await this.connection.sendTransaction(
          transaction,
          [this.wallet],
          { skipPreflight: false }
        );
        
        // Wait for confirmation
        const confirmation = await this.connection.confirmTransaction(txid, 'confirmed');
        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }
        
        console.log(`Trade executed successfully: ${txid}`);
      } catch (error: unknown) {
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
      const result: TradeResult = {
        id: txid,
        inputToken,
        outputToken,
        inputAmount,
        outputAmount,
        executionPrice,
        slippage: route.slippageBps ? route.slippageBps / 10000 : 0,
        priceImpact: route.priceImpactPct || 0,
        fee: route.marketInfos.reduce((acc, info) => 
          Number(acc) + Number(info.lpFee?.amount || BigInt(0)) + Number(info.platformFee?.amount || BigInt(0)), 0),
        route: route.marketInfos.map((info: any) => info.label),
        timestamp: Date.now()
      };

      // Update position tracking
      const position: Position = {
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
    } catch (error) {
      console.error('Error executing trade:', error);
      throw error;
    }
  }

  private async handleRiskManagement(): Promise<void> {
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
      } catch (error) {
        console.error(`Error in risk management for position ${id}:`, error);
      }
    }
  }

  private addToHistory(result: TradeResult): void {
    if (this.tradeHistory.size >= this.MAX_HISTORY) {
      const oldestKey = this.tradeHistory.keys().next().value;
      if (oldestKey) {
        this.tradeHistory.delete(oldestKey);
      }
    }
    this.tradeHistory.set(result.id, result);
  }
}
