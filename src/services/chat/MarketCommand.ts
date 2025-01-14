import { Connection, PublicKey } from '@solana/web3.js';
import { elizaLogger } from "@ai16z/eliza";
import { CommandResult } from '../../types/chat';
import { TokenProvider } from '../../providers/token';
import { RedisService } from '../market/data/RedisCache';
import { WalletProvider } from '../../providers/wallet';

export class MarketCommand {
  private connection: Connection;
  private walletProvider: WalletProvider;
  private tokenProvider: TokenProvider;

  constructor(config: { rpcUrl: string }) {
    this.connection = new Connection(config.rpcUrl);
    if (!process.env.WALLET_PUBLIC_KEY) {
      throw new Error('WALLET_PUBLIC_KEY environment variable is not set');
    }
    this.walletProvider = new WalletProvider(this.connection, new PublicKey(process.env.WALLET_PUBLIC_KEY));
    this.tokenProvider = new TokenProvider(
      'tokenAddress',
      this.walletProvider,
      new RedisService({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
        keyPrefix: 'jupiter-price:',
        enableCircuitBreaker: true
      }),
      { apiKey: '', retryAttempts: 3, retryDelay: 2000, timeout: 10000 }
    );
  }

  async execute(args: string[]): Promise<CommandResult> {
    try {
      if (!args.length) {
        return {
          success: false,
          message: 'Please specify a token symbol (e.g., market BTC)'
        };
      }

      const symbol = args[0].toUpperCase();
      const tokenAddress = await this.tokenProvider.getTokenAddressFromTicker(symbol);
      if (!tokenAddress) {
        return {
          success: false,
          message: `Token address not found for symbol: ${symbol}`
        };
      }

      this.tokenProvider.setTokenAddress(tokenAddress);
      const tokenReport = await this.tokenProvider.getFormattedTokenReport();

      return {
        success: true,
        data: tokenReport,
        message: tokenReport
      };
    } catch (error) {
      elizaLogger.error('Market command error:', error);
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async analyze(args: string[]): Promise<CommandResult> {
    try {
      const symbol = args[0]?.toUpperCase();
      if (!symbol) {
        return {
          success: false,
          message: 'Please specify a token to analyze'
        };
      }

      this.tokenProvider.setTokenAddress(symbol);
      const metrics = await this.tokenProvider.getFormattedTokenReport();
      return {
        success: true,
        data: metrics,
        message: this.formatAnalysis(symbol, metrics)
      };
    } catch (error) {
      elizaLogger.error('Analysis error:', error);
      return {
        success: false,
        message: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async generateMarketTweet(args: string[]): Promise<CommandResult> {
    try {
      const symbol = args[0]?.toUpperCase();
      if (!symbol) {
        return {
          success: false,
          message: 'Please specify a token for the tweet'
        };
      }

      this.tokenProvider.setTokenAddress(symbol);
      const metrics = await this.tokenProvider.getFormattedTokenReport();
      const tweet = this.formatTweetContent(symbol, metrics);

      return {
        success: true,
        data: { tweet, metrics },
        message: tweet
      };
    } catch (error) {
      elizaLogger.error('Tweet generation error:', error);
      return {
        success: false,
        message: `Tweet generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private formatMarketData(symbol: string, data: any): string {
    return `
${symbol} Market Data:
Price: $${data.price.toFixed(4)}
24h Change: ${data.priceChange24h.toFixed(2)}%
Volume: $${data.volume24h.toLocaleString()}
Market Cap: $${data.marketCap.toLocaleString()}
Confidence: ${data.confidenceLevel}
`;
  }

  private formatAnalysis(symbol: string, metrics: any): string {
    return `
${symbol} Market Analysis:
Current Price: $${metrics.price.toFixed(4)}
24h Performance: ${metrics.priceChange24h > 0 ? '📈' : '📉'} ${metrics.priceChange24h.toFixed(2)}%
Volume Analysis: ${this.analyzeVolume(metrics.volume24h)}
Market Cap Rank: ${this.analyzeMarketCap(metrics.marketCap)}
Confidence Level: ${metrics.confidenceLevel.toUpperCase()}
`;
  }

  private formatTweetContent(symbol: string, metrics: any): string {
    return `
${symbol} Market Update 🚀
💰 Price: $${metrics.price.toFixed(4)}
📊 24h: ${metrics.priceChange24h > 0 ? '↗️' : '↘️'} ${metrics.priceChange24h.toFixed(2)}%
📈 Vol: $${(metrics.volume24h / 1000000).toFixed(2)}M
#${symbol} #Crypto
`;
  }

  private analyzeVolume(volume: number): string {
    if (volume > 1000000) return 'High 🔥';
    if (volume > 100000) return 'Moderate 📊';
    return 'Low 📉';
  }

  private analyzeMarketCap(marketCap: number): string {
    if (marketCap > 1000000000) return 'Large Cap 🔵';
    if (marketCap > 100000000) return 'Mid Cap 🟡';
    return 'Small Cap 🟢';
  }
}