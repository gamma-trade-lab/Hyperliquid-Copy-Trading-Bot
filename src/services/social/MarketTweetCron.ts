import { TweetGenerator } from '../ai/tweetGenerator.js';
import { TradingService } from '../blockchain/trading.js';
import { AgentTwitterClientService } from './agentTwitterClient.js';
import { CONFIG } from '../../config/settings.js';
import { MarketData } from '../../types/market.js';
import { JupiterPriceV2 } from '../blockchain/defi/jupiterPriceV2.js';
import { getJupiterSwaps, getTokenTransfers } from '../blockchain/heliusIntegration.js';

export class MarketTweetCron {
  private tweetGenerator: TweetGenerator;
  private tradingService: TradingService;
  private twitterClient: AgentTwitterClientService;
  private jupiterPriceService: JupiterPriceV2;
  private intervalId?: NodeJS.Timeout;

  constructor(
    tweetGenerator: TweetGenerator,
    tradingService: TradingService,
    twitterClient: AgentTwitterClientService
  ) {
    this.tweetGenerator = tweetGenerator;
    this.tradingService = tradingService;
    this.twitterClient = twitterClient;
    this.jupiterPriceService = new JupiterPriceV2();
  }

  public start(): void {
    // Post initial update
    this.postMarketUpdate();

    // Schedule periodic updates using configured interval
    this.intervalId = setInterval(
      () => this.postMarketUpdate(),
      60 * 1000 // 1 minute (temporary for testing)
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
        console.log('Fetching market data...');
        // Get latest market data from multiple sources
        const baseMarketData = await this.tradingService.getMarketData(CONFIG.SOLANA.PUBLIC_KEY);
        let marketData = { ...baseMarketData };
        
        try {
          console.log('Fetching Jupiter and Helius data...');
          
          // Get Jupiter price data for token and SOL with retries
          const SOL_MINT = 'So11111111111111111111111111111111111111112';
          let jupiterPrices;
          for (let i = 0; i < 3; i++) {
            try {
              jupiterPrices = await this.jupiterPriceService.getPrices([
                CONFIG.SOLANA.PUBLIC_KEY,
                SOL_MINT
              ]);
              break;
            } catch (error) {
              console.error(`Jupiter price fetch attempt ${i + 1} failed:`, error);
              if (i === 2) throw error;
              await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
          }
          
          console.log('Jupiter prices:', jupiterPrices);
          
          // Get on-chain transaction data with parallel fetching
          const [recentSwaps, recentTransfers] = await Promise.all([
            getJupiterSwaps(CONFIG.SOLANA.PUBLIC_KEY, 20),  // Increased sample size
            getTokenTransfers(CONFIG.SOLANA.PUBLIC_KEY, 20)
          ]);
          
          // Calculate 24h volume from token transfers in swaps
          const volume24h = recentSwaps.reduce((total, swap) => {
            return total + swap.tokenTransfers.reduce((tokenTotal, transfer) => {
              return tokenTotal + (transfer.amount || 0);
            }, 0);
          }, 0);
          
          // Update market data with enhanced data
          marketData = {
            ...marketData,
            price: jupiterPrices?.data?.[CONFIG.SOLANA.PUBLIC_KEY]?.price ?? marketData.price,
            volume24h: volume24h || marketData.volume24h,
            onChainData: {
              recentSwaps: recentSwaps.length,
              recentTransfers: recentTransfers.length,
              totalTransactions: recentSwaps.length + recentTransfers.length
            }
          };

          console.log('Enhanced market data fetched:', marketData);
        } catch (error) {
          console.error('Error fetching enhanced market data:', error);
          // Continue with base market data
        }

        // Generate tweet content with available market data
        const tweet = await this.tweetGenerator.generateTweetContent({
          marketData,
          style: {
            tone: this.determineMarketTone(marketData),
            humor: 0,
            formality: 0.8
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
