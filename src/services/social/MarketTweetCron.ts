import { TweetGenerator } from '../ai/tweetGenerator';
import { TradingService } from '../blockchain/trading';
import { AgentTwitterClientService } from './agentTwitterClient';
import { CONFIG } from '../../config/settings';
import { MarketData } from '../ai/types';

export class MarketTweetCron {
  private tweetGenerator: TweetGenerator;
  private tradingService: TradingService;
  private twitterClient: AgentTwitterClientService;
  private intervalId?: NodeJS.Timeout;

  constructor(
    tweetGenerator: TweetGenerator,
    tradingService: TradingService,
    twitterClient: AgentTwitterClientService
  ) {
    this.tweetGenerator = tweetGenerator;
    this.tradingService = tradingService;
    this.twitterClient = twitterClient;
  }

  public start(): void {
    // Post initial update
    this.postMarketUpdate();

    // Schedule periodic updates using configured interval
    this.intervalId = setInterval(
      () => this.postMarketUpdate(),
      CONFIG.AUTOMATION.MARKET_MONITORING_INTERVAL
    );
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private async postMarketUpdate(): Promise<void> {
    try {
      // Get latest market data
      const marketData: MarketData = await this.tradingService.getMarketData();

      // Generate tweet content
      const tweet = await this.tweetGenerator.generateTweetContent({
        marketData,
        style: {
          tone: this.determineMarketTone(marketData),
          humor: 0.7,
          formality: 0.5
        },
        constraints: {
          maxLength: 280,
          includeTickers: true,
          includeMetrics: true
        }
      });

      // Post the tweet
      await this.twitterClient.postTweet(tweet.content);

      console.log('Market update tweet posted successfully:', tweet.content);
    } catch (error) {
      console.error('Failed to post market update tweet:', error);
      // Don't throw - we want the cron to continue running even if one update fails
    }
  }

  private determineMarketTone(marketData: MarketData): 'bullish' | 'bearish' | 'neutral' {
    const priceChange = marketData.priceChange24h;
    if (priceChange > 5) return 'bullish';
    if (priceChange < -5) return 'bearish';
    return 'neutral';
  }
}
