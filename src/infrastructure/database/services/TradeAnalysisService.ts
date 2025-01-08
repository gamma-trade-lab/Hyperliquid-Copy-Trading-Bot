import { PublicKey } from '@solana/web3.js';
import { Jupiter, RouteInfo } from '@jup-ag/core';
import { Helius } from 'helius-sdk';
import { RedisService } from './RedisService.js';
import { TradeAnalysis, ITradeAnalysis } from '../schemas/TradeAnalysis.schema.js';
import { Logger } from '../../../utils/logger.js';
const logger = new Logger('TradeAnalysisService');
import  CONFIG  from '../../../config/settings.js';

interface HeliusAssetResponse {
  content?: {
    metadata?: {
      name?: string;
      symbol?: string;
    };
  };
  token_info?: {
    price?: number;
    price_24h_change?: number;
    volume_24h?: number;
    market_cap?: number;
  };
  ownership?: {
    total?: number;
  };
}

interface HeliusTokenInsights {
  aiScore: number;
  tokenAddress: string;
  marketCap?: number;
  volumeUsd24h?: number;
  priceUsd?: number;
  priceChange24h?: number;
  holders?: number;
}

interface VolatilityMetrics {
  hourly: number;
  daily: number;
  weekly: number;
}

export class TradeAnalysisService {
  private static instance: TradeAnalysisService;
  private redisService: RedisService;
  private jupiter!: Jupiter;
  private helius: Helius;
  private heliusApiKey: string;
  private heliusBaseUrl: string;

  private constructor() {
    this.redisService = RedisService.getInstance();
    this.helius = new Helius(CONFIG.SOLANA.helius.API_KEY);
    this.heliusApiKey = CONFIG.SOLANA.helius.API_KEY;
    this.heliusBaseUrl = CONFIG.SOLANA.helius.BASE_URL;
  }

  public static getInstance(): TradeAnalysisService {
    if (!TradeAnalysisService.instance) {
      TradeAnalysisService.instance = new TradeAnalysisService();
    }
    return TradeAnalysisService.instance;
  }

  /**
   * Analyze a trade using Helius AI and internal metrics
   */
  async analyzeTrade(
    inputMint: string,
    outputMint: string,
    amount: string,
    agentId: string
  ): Promise<ITradeAnalysis> {
    try {
      // Get route from Jupiter
      const routeMap = await this.jupiter.computeRoutes({
        inputMint: new PublicKey(inputMint),
        outputMint: new PublicKey(outputMint),
        amount: amount,
        slippageBps: 50, // 0.5%
      });
      
      const route = routeMap.routesInfos[0]; // Get best route

      // Get Helius AI insights
      // Get token insights using Helius RPC
      // Get token insights using Helius RPC
      const assetInfo = await this.helius.rpc.getAsset({
        id: inputMint
      }) as HeliusAssetResponse;

      const heliusInsights = {
        aiScore: 50, // Default AI score since it's not provided by the API
        tokenAddress: inputMint,
        marketCap: assetInfo.token_info?.market_cap || 0,
        volumeUsd24h: assetInfo.token_info?.volume_24h || 0,
        priceUsd: assetInfo.token_info?.price || 0,
        priceChange24h: assetInfo.token_info?.price_24h_change || 0,
        holders: assetInfo.ownership?.total || 0
      } as HeliusTokenInsights;

      // Calculate volatility metrics
      const volatilityMetrics = await this.calculateVolatilityMetrics(inputMint);

      // Create trade analysis
      const analysis: Partial<ITradeAnalysis> = {
        signature: '', // Will be filled after execution
        timestamp: new Date(),
        inputToken: {
          mint: inputMint,
          symbol: '', // Will be populated from token metadata
          amount: route.inAmount,
          usdValue: 0 // Will be calculated from price data
        },
        outputToken: {
          mint: outputMint,
          symbol: '', // Will be populated from token metadata
          amount: route.outAmount,
          usdValue: 0 // Will be calculated from price data
        },
        priceImpact: route.priceImpactPct,
        slippage: 0.5,
        route: {
          marketInfos: route.marketInfos.map((info: any) => ({
            amm: info.label || 'Unknown AMM',
            label: info.label || 'Unknown AMM',
            inAmount: info.inAmount || '0',
            outAmount: info.outAmount || '0',
            priceImpact: info.priceImpactPct || 0
          }))
        },
        aiAnalysis: await this.generateAIAnalysis(route, heliusInsights, volatilityMetrics),
        metadata: {
          heliusAiScore: heliusInsights.aiScore,
          marketConditions: this.determineMarketConditions(volatilityMetrics),
          volatilityMetrics,
          relatedTransactions: []
        },
        agentId,
        status: 'ANALYZED'
      };

      const tradeAnalysis = new TradeAnalysis(analysis);
      await tradeAnalysis.save();

      // Cache analysis for quick access
      await this.redisService.set(
        `trade_analysis:${tradeAnalysis.id}`,
        tradeAnalysis,
        300 // 5 minutes
      );

      return tradeAnalysis;
    } catch (error) {
      logger.error('Error analyzing trade:', error);
      throw error;
    }
  }

  /**
   * Execute a trade based on analysis
   */
  async executeTrade(analysisId: string): Promise<ITradeAnalysis> {
    try {
      const analysis = await TradeAnalysis.findById(analysisId);
      if (!analysis) throw new Error('Trade analysis not found');

      analysis.status = 'PENDING_EXECUTION';
      await analysis.save();

      try {
        // Execute trade using Jupiter
        const exchange = await this.jupiter.exchange({
          routeInfo: analysis.route as unknown as RouteInfo,
          userPublicKey: new PublicKey(CONFIG.SOLANA.PUBLIC_KEY)
        });
        
        // Execute the swap 
        const swapResult = await exchange.execute();
        const txid = typeof swapResult === 'object' && 'txid' in swapResult ? swapResult.txid : '';

        analysis.status = 'EXECUTED';
        analysis.executionResult = {
          success: true,
          signature: txid,
          gasUsed: 0, // Not tracked in Jupiter v6
          actualSlippage: 0 // Would need manual calculation
        };
      } catch (error) {
        analysis.status = 'FAILED';
        analysis.executionResult = {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
        throw error;
      }

      await analysis.save();
      return analysis;
    } catch (error) {
      logger.error('Error executing trade:', error);
      throw error;
    }
  }

  private async generateAIAnalysis(
    route: RouteInfo,
    heliusInsights: HeliusTokenInsights,
    volatilityMetrics: VolatilityMetrics
  ): Promise<{
    confidence: number;
    recommendation: 'BUY' | 'SELL' | 'HOLD';
    reasoning: string;
    predictedPriceImpact: number;
    riskScore: number;
  }> {
    // Implement AI analysis logic here
    const confidence = this.calculateConfidence(route, heliusInsights, volatilityMetrics);
    const recommendation = this.generateRecommendation(confidence, route.priceImpactPct);
    const riskScore = this.calculateRiskScore(volatilityMetrics, route.priceImpactPct);

    return {
      confidence,
      recommendation,
      reasoning: this.generateReasoning(confidence, recommendation, riskScore),
      predictedPriceImpact: route.priceImpactPct,
      riskScore
    };
  }

  private calculateConfidence(
    route: RouteInfo,
    heliusInsights: HeliusTokenInsights,
    volatilityMetrics: VolatilityMetrics
  ): number {
    // Implement confidence calculation logic
    const priceImpactWeight = 0.3;
    const heliusScoreWeight = 0.4;
    const volatilityWeight = 0.3;

    const priceImpactScore = Math.max(0, 1 - route.priceImpactPct);
    const heliusScore = heliusInsights.aiScore / 100;
    const volatilityScore = 1 - (volatilityMetrics.hourly / 100);

    return (
      priceImpactScore * priceImpactWeight +
      heliusScore * heliusScoreWeight +
      volatilityScore * volatilityWeight
    );
  }

  private generateRecommendation(
    confidence: number,
    priceImpact: number
  ): 'BUY' | 'SELL' | 'HOLD' {
    if (confidence > 0.8 && priceImpact < 0.01) return 'BUY';
    if (confidence < 0.3 || priceImpact > 0.05) return 'SELL';
    return 'HOLD';
  }

  private calculateRiskScore(volatilityMetrics: VolatilityMetrics, priceImpact: number): number {
    const volatilityWeight = 0.6;
    const priceImpactWeight = 0.4;

    const volatilityScore = (
      volatilityMetrics.hourly * 0.5 +
      volatilityMetrics.daily * 0.3 +
      volatilityMetrics.weekly * 0.2
    );

    const priceImpactScore = priceImpact * 100;

    return Math.min(
      100,
      volatilityScore * volatilityWeight + priceImpactScore * priceImpactWeight
    );
  }

  private generateReasoning(
    confidence: number,
    recommendation: string,
    riskScore: number
  ): string {
    const confidenceLevel = confidence > 0.8 ? 'high' : confidence > 0.5 ? 'moderate' : 'low';
    const riskLevel = riskScore > 70 ? 'high' : riskScore > 30 ? 'moderate' : 'low';

    return `Based on analysis with ${confidenceLevel} confidence (${(confidence * 100).toFixed(2)}%) `
      + `and ${riskLevel} risk (${riskScore.toFixed(2)}), the recommendation is to ${recommendation}. `
      + `This takes into account current market conditions, volatility metrics, and AI insights.`;
  }

  private async calculateVolatilityMetrics(tokenAddress: string): Promise<VolatilityMetrics> {
    try {
      // Get historical price data from Helius
      const assetData = await this.helius.rpc.getAsset({ id: tokenAddress }) as HeliusAssetResponse;
      const priceHistory = [assetData.token_info?.price || 0]; // Use current price since history isn't available
      
      // Calculate volatility from price history (placeholder implementation)
      const volatility = priceHistory.length > 0 ? 
        Math.abs(priceHistory[priceHistory.length - 1] - priceHistory[0]) / priceHistory[0] * 100 : 
        Math.random() * 30;

      return {
        hourly: volatility * 0.4,  // Scale for different timeframes
        daily: volatility * 0.7,
        weekly: volatility
      };
    } catch (error) {
      logger.warn(`Failed to get volatility metrics for ${tokenAddress}:`, error);
      return {
        hourly: Math.random() * 10,
        daily: Math.random() * 20,
        weekly: Math.random() * 30
      };
    }
  }

  private determineMarketConditions(volatilityMetrics: VolatilityMetrics): string {
    const avgVolatility = (
      volatilityMetrics.hourly +
      volatilityMetrics.daily +
      volatilityMetrics.weekly
    ) / 3;

    if (avgVolatility > 50) return 'HIGHLY_VOLATILE';
    if (avgVolatility > 20) return 'MODERATELY_VOLATILE';
    return 'STABLE';
  }

  async analyzeTrades() {
    // Use heliusApiKey and heliusBaseUrl for trade analysis
    console.log(`Using Helius API Key: ${this.heliusApiKey}`);
    console.log(`Using Helius Base URL: ${this.heliusBaseUrl}`);
    
  }
}