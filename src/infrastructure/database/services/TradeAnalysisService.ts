import { Connection, PublicKey } from '@solana/web3.js';
import { Jupiter } from '@jup-ag/core';
import { Helius } from 'helius-sdk';
import { RedisService } from './RedisService';
import { TradeAnalysis, ITradeAnalysis } from '../schemas/TradeAnalysis.schema';
import { logger } from '../../../utils/logger';
import config from '../../../config';

export class TradeAnalysisService {
  private static instance: TradeAnalysisService;
  private redisService: RedisService;
  private jupiter: Jupiter;
  private helius: Helius;
  private connection: Connection;

  private constructor() {
    this.redisService = RedisService.getInstance();
    this.helius = new Helius(config.helius.apiKey);
    this.connection = new Connection(config.solana.rpcEndpoint);
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
      const route = await this.jupiter.computeRoutes({
        inputMint: new PublicKey(inputMint),
        outputMint: new PublicKey(outputMint),
        amount: amount,
        slippageBps: 50, // 0.5%
      });

      // Get Helius AI insights
      const heliusInsights = await this.helius.getTokenInsights(inputMint);

      // Calculate volatility metrics
      const volatilityMetrics = await this.calculateVolatilityMetrics(inputMint);

      // Create trade analysis
      const analysis: Partial<ITradeAnalysis> = {
        signature: '', // Will be filled after execution
        timestamp: new Date(),
        inputToken: {
          mint: inputMint,
          symbol: route.inputToken.symbol,
          amount: amount,
          usdValue: route.inputToken.usdValue
        },
        outputToken: {
          mint: outputMint,
          symbol: route.outputToken.symbol,
          amount: route.outputAmount.toString(),
          usdValue: route.outputToken.usdValue
        },
        priceImpact: route.priceImpactPct,
        slippage: 0.5,
        route: {
          marketInfos: route.marketInfos.map(info => ({
            amm: info.ammName,
            label: info.label,
            inAmount: info.inAmount,
            outAmount: info.outAmount,
            priceImpact: info.priceImpactPct
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
        const result = await this.jupiter.exchange({
          routeInfo: analysis.route,
          userPublicKey: new PublicKey(config.solana.traderAddress)
        });

        analysis.status = 'EXECUTED';
        analysis.executionResult = {
          success: true,
          signature: result.signature,
          gasUsed: result.gasUsed,
          actualSlippage: result.actualSlippage
        };
      } catch (error) {
        analysis.status = 'FAILED';
        analysis.executionResult = {
          success: false,
          error: error.message
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

  private async generateAIAnalysis(route: any, heliusInsights: any, volatilityMetrics: any) {
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

  private calculateConfidence(route: any, heliusInsights: any, volatilityMetrics: any): number {
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

  private calculateRiskScore(volatilityMetrics: any, priceImpact: number): number {
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

  private async calculateVolatilityMetrics(mint: string) {
    // Implement volatility calculation logic
    // This would typically involve analyzing price history data
    return {
      hourly: 0, // Placeholder
      daily: 0,  // Placeholder
      weekly: 0  // Placeholder
    };
  }

  private determineMarketConditions(volatilityMetrics: any): string {
    const avgVolatility = (
      volatilityMetrics.hourly +
      volatilityMetrics.daily +
      volatilityMetrics.weekly
    ) / 3;

    if (avgVolatility > 50) return 'HIGHLY_VOLATILE';
    if (avgVolatility > 20) return 'MODERATELY_VOLATILE';
    return 'STABLE';
  }
} 