import { Command, CommandResult } from '@/types/chat.js';
import { JupiterPriceV2Service } from '../blockchain/defi/JupiterPriceV2Service.js';
import { elizaLogger } from "@ai16z/eliza";
import { getTokenAddressFromTicker } from '../../providers/token.js';
import { AIService } from '../ai';

export class MarketCommand {
  constructor(
    private jupiterService: JupiterPriceV2Service,
    private aiService: AIService
  ) {}

  getCommand(): Command {
    return {
      name: 'market',
      description: 'Get market data for any token',
      execute: async (args: string[]): Promise<CommandResult> => {
        try {
          if (!args.length) {
            return {
              success: false,
              message: 'Please specify a token symbol (e.g., market SOL)'
            };
          }

          const symbol = args[0].toUpperCase();
          elizaLogger.info(`Fetching market data for ${symbol}`);

          // First get the token address from DexScreener
          const tokenAddress = await getTokenAddressFromTicker(symbol);
          if (!tokenAddress) {
            return {
              success: false,
              message: `Could not find token ${symbol} on DexScreener`
            };
          }

          // Set the token address in Jupiter service
          this.jupiterService.setTokenAddress(tokenAddress);

          // Get market data with error handling
          elizaLogger.info(`Fetching market data for token ${symbol} (${tokenAddress})`);
          let marketData;
          try {
            marketData = await this.jupiterService.getMarketData(symbol);
          } catch (error) {
            elizaLogger.error(`Error fetching market data:`, error);
            return {
              success: false,
              message: `Error fetching market data for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
          }
          
          if (!marketData) {
            elizaLogger.warn(`No market data returned for ${symbol}`);
            return {
              success: false,
              message: `No market data available for ${symbol}. Token might be too new or have no liquidity.`
            };
          }
          
          elizaLogger.info(`Successfully fetched market data for ${symbol}`);

          // Get AI analysis
          elizaLogger.info(`Generating AI analysis for ${symbol}`);
          const analysis = await this.generateMarketAnalysis(symbol, marketData);

          // Format and display the combined output
          console.log(`\n${symbol} Market Analysis:`);
          console.log(`\nMarket Data:`);
          console.log(`Price: ${marketData.price.toFixed(4)}`);
          console.log(`24h Change: ${marketData.priceChange24h.toFixed(2)}%`);
          console.log(`24h Volume: ${this.formatNumber(marketData.volume24h)}`);
          console.log(`Market Cap: ${this.formatNumber(marketData.marketCap)}`);
          console.log(`Token Address: ${tokenAddress}`);
          
          console.log(`\nAI Analysis:`);
          console.log(analysis.summary);
          console.log(`\nRisk Level: ${analysis.riskLevel}`);
          console.log(`Market Sentiment: ${analysis.sentiment}`);
          if (analysis.keyPoints.length > 0) {
            console.log(`\nKey Points:`);
            analysis.keyPoints.forEach(point => console.log(`• ${point}`));
          }
          if (analysis.recommendation) {
            console.log(`\nRecommendation: ${analysis.recommendation}`);
          }

          return {
            success: true,
            data: {
              symbol,
              price: marketData.price,
              priceChange24h: marketData.priceChange24h,
              volume24h: marketData.volume24h,
              marketCap: marketData.marketCap,
              address: tokenAddress
            },
            message: 'Market data retrieved successfully'
          };

        } catch (error) {
          elizaLogger.error(`Error fetching market data for ${args[0]}:`, error);
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error fetching market data'
          };
        }
      }
    };
  }

  private formatNumber(num: number): string {
    if (num >= 1e9) {
      return (num / 1e9).toFixed(2) + 'B';
    }
    if (num >= 1e6) {
      return (num / 1e6).toFixed(2) + 'M';
    }
    if (num >= 1e3) {
      return (num / 1e3).toFixed(2) + 'K';
    }
    return num.toFixed(2);
  }

  private async generateMarketAnalysis(symbol: string, marketData: any) {
    try {
      // Prepare market context for AI analysis
      const context = {
        symbol,
        currentPrice: marketData.price,
        priceChange24h: marketData.priceChange24h,
        volume24h: marketData.volume24h,
        marketCap: marketData.marketCap,
        timestamp: Date.now()
      };

      // Generate AI analysis using market context
      const prompt = `
        Analyze the following market data for ${symbol}:
        - Current Price: ${context.currentPrice}
        - 24h Price Change: ${context.priceChange24h}%
        - 24h Volume: ${this.formatNumber(context.volume24h)}
        - Market Cap: ${this.formatNumber(context.marketCap)}

        Provide a concise analysis including:
        1. Overall market sentiment
        2. Key market indicators and their implications
        3. Potential risks and opportunities
        4. Trade recommendation based on current market conditions
        5. Key points for investors to consider
      `;

      const analysis = await this.aiService.analyzeMarket(prompt);

      // Process and structure the AI response
      return {
        summary: analysis.summary || "AI analysis not available",
        sentiment: analysis.sentiment || "NEUTRAL",
        riskLevel: this.calculateRiskLevel(marketData),
        keyPoints: analysis.keyPoints || [],
        recommendation: analysis.recommendation || null
      };
    } catch (error) {
      elizaLogger.error('Error generating AI analysis:', error);
      return {
        summary: "AI analysis temporarily unavailable",
        sentiment: "NEUTRAL",
        riskLevel: "MEDIUM",
        keyPoints: [],
        recommendation: null
      };
    }
  }

  private calculateRiskLevel(marketData: any): string {
    const volatility = Math.abs(marketData.priceChange24h);
    if (volatility > 20) return "HIGH";
    if (volatility > 10) return "MEDIUM";
    return "LOW";
  }
}