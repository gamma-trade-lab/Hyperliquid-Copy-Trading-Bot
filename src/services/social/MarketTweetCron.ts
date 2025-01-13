// src/services/social/MarketTweetCron.ts
import { TweetGenerator } from '../ai/tweetGenerator.js';
import { TradingService } from '../blockchain/trading.js';
import { AgentTwitterClientService } from './agentTwitterClient.js';
import { CONFIG } from '../../config/settings.js';
import { MarketData, JupiterSwap } from '../../types/market.js';
import { JupiterPriceV2Service, JupiterService } from '../blockchain/defi/JupiterPriceV2Service.js';
import { HeliusService } from '../blockchain/heliusIntegration.js';
import { elizaLogger } from "@ai16z/eliza";

import { Connection, PublicKey } from '@solana/web3.js';
import { TokenProvider } from '@/providers/token.js';
import { WalletProvider } from '@/providers/wallet.js';
import { RedisService } from '../market/data/RedisCache.js';



interface MarketTweetOptions {
  tokenAddress: string;
  interval?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export class MarketTweetCron {
  private tweetGenerator: TweetGenerator;
  private tradingService: TradingService;
  private twitterClient: AgentTwitterClientService;
  private jupiterService: JupiterPriceV2Service;
  private heliusService: HeliusService;
  private intervalId?: NodeJS.Timeout;

  private readonly DEFAULT_INTERVAL = 1800000; // 30 minutes
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 5000; // 5 seconds

  constructor(
    tweetGenerator: TweetGenerator,
    tradingService: TradingService,
    twitterClient: AgentTwitterClientService,
    heliusApiKey: string
  ) {
    this.tweetGenerator = tweetGenerator;
    this.tradingService = tradingService;
    this.twitterClient = twitterClient;
    
    // Ensure environment variables are defined
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = Number(process.env.REDIS_PORT) || 6379;
    const redisPassword = process.env.REDIS_PASSWORD;
    const solanaRpcUrl = process.env.SOLANA_RPC_URL || '';
    const walletPublicKey = process.env.WALLET_PUBLIC_KEY || '';
    const apiKey = process.env.API_KEY || '';

    // Initialize JupiterPriceV2Service with config
    this.jupiterService = new JupiterPriceV2Service({
      redis: {
        host: redisHost,
        port: redisPort,
        password: redisPassword,
        keyPrefix: 'jupiter-price:',
        enableCircuitBreaker: true
      },
      rpcConnection: {
        url: solanaRpcUrl,
        walletPublicKey: walletPublicKey
      },
      rateLimitConfig: {
        requestsPerMinute: 600,
        windowMs: 60000
      }
    }, new TokenProvider('', new WalletProvider(new Connection(solanaRpcUrl), new PublicKey(walletPublicKey)), new RedisService({
      host: redisHost,
      port: redisPort,
      password: redisPassword
    }), { apiKey }), new RedisService({
      host: redisHost,
      port: redisPort,
      password: redisPassword
    }), new JupiterService());
    
    this.heliusService = new HeliusService(heliusApiKey);
  }

  public async start(options: MarketTweetOptions): Promise<void> {
    try {
      await this.verifyServices();
      await this.postMarketUpdate(options.tokenAddress);

      this.intervalId = setInterval(
        () => this.postMarketUpdate(options.tokenAddress),
        options.interval || this.DEFAULT_INTERVAL
      );

      elizaLogger.info(`Market tweet cron started with ${options.interval || this.DEFAULT_INTERVAL}ms interval`);
    } catch (error) {
      elizaLogger.error('Failed to start market tweet cron:', error);
      throw error;
    }
  }

  private async verifyServices(): Promise<void> {
    const isHeliusHealthy = await this.heliusService.isHealthy();
    if (!isHeliusHealthy) {
      throw new Error('Helius service is not healthy');
    }

    try {
      await this.jupiterService.getTokenPrice('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    } catch (error) {
      throw new Error('Jupiter service is not responding');
    }
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      elizaLogger.info('Market tweet cron stopped');
    }
  }

  private async postMarketUpdate(tokenAddress: string): Promise<void> {
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        elizaLogger.info('Fetching market data...');
        
        // Get base market data
        const baseMarketData = await this.tradingService.getMarketData(tokenAddress);
        
        // Get holder information
        const holderInfo = await this.heliusService.getHoldersClassification(tokenAddress);
        if (!holderInfo) {
          throw new Error('Failed to fetch holder information');
        }

        // Get Jupiter price data
        const tokenPrice = await this.jupiterService.getTokenPrice(tokenAddress);
        if (!tokenPrice) {
          throw new Error('Failed to fetch Jupiter price data');
        }

        // Get recent transactions
        const [recentTransactions, recentSwaps] = await Promise.all([
          this.heliusService.getTransactions(tokenAddress, { limit: 100 }),
          this.heliusService.getJupiterSwaps(tokenAddress, { limit: 100 })
        ]);

        // Enhance market data
        const enhancedMarketData: MarketData = {
          ...baseMarketData,
          tokenAddress,
          price: Number(tokenPrice.price),
          volume24h: tokenPrice.extraInfo?.quotedPrice?.buyPrice 
            ? Number(tokenPrice.extraInfo.quotedPrice.buyPrice) * baseMarketData.volume24h 
            : baseMarketData.volume24h,
          holders: {
            total: holderInfo.totalHolders,
            top: holderInfo.topHolders.slice(0, 5).map(holder => ({
              address: holder.owner,
              balance: holder.balance,
              percentage: (holder.balance / holderInfo.totalSupply) * 100
            }))
          },
          onChainActivity: {
            transactions: recentTransactions.length,
            swaps: recentSwaps.length,
            uniqueTraders: new Set(recentSwaps.map((swap: JupiterSwap) => swap.data.author_id)).size
          },
          confidence: tokenPrice.extraInfo?.confidenceLevel || 'medium',
          lastUpdate: Date.now()
        };

        elizaLogger.info('Enhanced market data:', enhancedMarketData);

        // Generate and post tweet
        const tweet = await this.tweetGenerator.generateTweetContent({
          marketData: enhancedMarketData,
          style: {
            tone: this.determineMarketTone(enhancedMarketData),
            humor: 0,
            formality: 0.8
          },
          constraints: {
            maxLength: 280,
            includeTickers: true,
            includeMetrics: true
          }
        });

        await this.twitterClient.postTweet(tweet.content, {
          replyToTweetId: undefined
        });
        elizaLogger.success('Market update tweet posted successfully:', tweet.content);
        
        return;
      } catch (error) {
        const isLastAttempt = attempt === this.MAX_RETRIES;
        elizaLogger.error(`Market update attempt ${attempt}/${this.MAX_RETRIES} failed:`, error);
        
        if (isLastAttempt) {
          elizaLogger.error('All retry attempts failed for market update tweet');
        } else {
          elizaLogger.info(`Retrying in ${this.RETRY_DELAY/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        }
      }
    }
  }

  private determineMarketTone(marketData: MarketData): 'bullish' | 'bearish' | 'neutral' {
    if (!marketData.priceChange24h) return 'neutral';

    const priceChange = marketData.priceChange24h;
    const volumeChange = marketData.volume24h > 0 ? 1 : -1;
    
    const sentiment = priceChange * volumeChange;

    if (sentiment > 5) return 'bullish';
    if (sentiment < -5) return 'bearish';
    return 'neutral';
  }
}