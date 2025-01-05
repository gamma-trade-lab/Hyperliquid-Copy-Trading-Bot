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
      30 * 60 * 1000 // 30 minutes
    );
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private async postMarketUpdate(): Promise<void> {
    const maxRetries = 3;
    const retryDelay = 5000; // 5 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Get latest market data
        const marketData: MarketData = await this.tradingService.getMarketData();
        console.log('Market data fetched:', marketData);

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
        console.log('Tweet content generated:', tweet.content);

        // Post the tweet
        await this.twitterClient.postTweet(tweet.content);
        console.log('Market update tweet posted successfully:', tweet.content);
        
        // If successful, exit retry loop
        return;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        console.error(`Market update attempt ${attempt}/${maxRetries} failed:`, error);
        
        if (isLastAttempt) {
          console.error('All retry attempts failed for market update tweet');
        } else {
          console.log(`Retrying in ${retryDelay/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
  }

  private determineMarketTone(marketData: MarketData): 'bullish' | 'bearish' | 'neutral' {
    const priceChange = marketData.priceChange24h;
    if (priceChange > 5) return 'bullish';
    if (priceChange < -5) return 'bearish';
    return 'neutral';
  }
}
