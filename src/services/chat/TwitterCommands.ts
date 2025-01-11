import { ChatService } from './ChatService';
import { TwitterService } from '../social/twitter';
import { JupiterPriceV2Service } from '../blockchain/defi/JupiterPriceV2Service';
import { AIService } from '../ai/ai';
import { elizaLogger } from "@ai16z/eliza";
import { ModeConfig } from './types';

// Add interfaces for market data
interface MarketMetrics {
    volume24h: number;
    priceChange24h: number;
    marketCap: number;
  }
  
  interface PriceData {
    price: number;
  }
  
  interface MarketTweetData {
    topic: string;
    price: string;
    volume: string;
    priceChange: string;
  }
  
  export class TwitterCommands {
    constructor(
      private chatService: ChatService,
      private twitterService: TwitterService,
      private jupiterService: JupiterPriceV2Service,
      private aiService: AIService
    ) {}
  
    public getTwitterCommands(): Partial<ModeConfig> {
      return {
        commands: [
          {
            name: 'tweet',
            description: 'Post a tweet to Twitter. Usage: tweet <message>',
            execute: async (args: string[]): Promise<void> => {
              try {
                const tweetContent = args.join(' ');
                
                if (!tweetContent) {
                  console.log('Please provide a message to tweet');
                  return;
                }
  
                if (tweetContent.length > 280) {
                  console.log('Tweet exceeds 280 characters');
                  return;
                }
  
                const confirmationId = Math.random().toString(36).substring(7);
                console.log(`Posting tweet... (ID: ${confirmationId})`);
  
                await this.twitterService.postTweetWithRetry(tweetContent);
                elizaLogger.success(`Tweet posted successfully! (ID: ${confirmationId})`);
                
              } catch (error) {
                elizaLogger.error('Failed to post tweet:', error instanceof Error ? error.message : String(error));
                console.log('Failed to post tweet. Please try again.');
              }
            }
          },
          {
            name: 'market-tweet',
            description: 'Post market analysis tweet. Usage: market-tweet <symbol>',
            execute: async (args: string[]): Promise<void> => {
              try {
                const symbol = args[0];
                
                if (!symbol) {
                  console.log('Please provide a token symbol');
                  return;
                }
  
                console.log(`Fetching market data for ${symbol}...`);
  
                // Get price data with proper type assertion
                const tokenPrice = await this.jupiterService.getTokenPrice(symbol);
                const priceData: PriceData = {
                    price: tokenPrice ? parseFloat(tokenPrice.price) : 0
                };
                
                if (!priceData?.price) {
                  console.log(`Could not fetch price data for ${symbol}`);
                  return;
                }
  
                // Get market metrics with proper type assertion
                const marketMetricsResponse = await this.jupiterService.getMarketMetrics(symbol);
                const marketMetrics: MarketMetrics = marketMetricsResponse !== undefined && marketMetricsResponse !== null 
                  ? marketMetricsResponse 
                  : { volume24h: 0, priceChange24h: 0, marketCap: 0 };
                
                // Create tweet data
                const tweetData: MarketTweetData = {
                  topic: symbol,
                  price: priceData.price.toString(),
                  volume: (marketMetrics?.volume24h || 0).toString(),
                  priceChange: (marketMetrics?.priceChange24h || 0).toString()
                };
  
                console.log('Generating tweet content...');
                
                // Generate tweet content
                const content = await this.aiService.generateMarketTweet(tweetData);
                
                if (content === undefined || content === null) {
                  console.log('Failed to generate tweet content');
                  return;
                }
  
                console.log('Posting market analysis tweet...');
                await this.twitterService.postTweetWithRetry(content);
                
                elizaLogger.success('Market analysis tweet posted successfully!');
                console.log('Tweet content:', content);
  
              } catch (error) {
                elizaLogger.error('Failed to post market tweet:', error instanceof Error ? error.message : String(error));
                console.log('Failed to post market tweet. Please try again.');
              }
            }
          },
          {
            name: 'tweet-with-image',
            description: 'Post a tweet with an image. Usage: tweet-with-image <message> <imageUrl>',
            execute: async (args: string[]): Promise<void> => {
              try {
                if (args.length < 2) {
                  console.log('Please provide both message and image URL');
                  return;
                }
  
                const imageUrl = args.pop()!;
                const tweetContent = args.join(' ');
  
                if (tweetContent.length > 280) {
                  console.log('Tweet text exceeds 280 characters');
                  return;
                }
  
                console.log('Posting tweet with image...');
                await this.twitterService.postTweet(tweetContent, { mediaUrls: [imageUrl] });
                elizaLogger.success('Tweet with image posted successfully!');
  
              } catch (error) {
                elizaLogger.error('Failed to post tweet with image:', error instanceof Error ? error.message : String(error));
                console.log('Failed to post tweet with image. Please try again.');
              }
            }
          },
          {
            name: 'tweet-thread',
            description: 'Post a thread of tweets. Usage: tweet-thread <message1> | <message2> | ...',
            execute: async (args: string[]): Promise<void> => {
              try {
                const thread = args.join(' ').split('|').map(tweet => tweet.trim());
                
                if (thread.length < 2) {
                  console.log('Please provide at least 2 tweets separated by |');
                  return;
                }
  
                for (const tweet of thread) {
                  if (tweet.length > 280) {
                    console.log(`Tweet exceeds 280 characters: "${tweet.substring(0, 50)}..."`);
                    return;
                  }
                }
  
                console.log(`Posting thread of ${thread.length} tweets...`);
  
                for (let i = 0; i < thread.length; i++) {
                  await this.twitterService.postTweetWithRetry(thread[i]);
                  elizaLogger.success(`Posted tweet ${i + 1}/${thread.length}`);
                  
                  if (i < thread.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                  }
                }
  
                elizaLogger.success('Thread posted successfully!');
  
              } catch (error) {
                elizaLogger.error('Failed to post thread:', error instanceof Error ? error.message : String(error));
                console.log('Failed to post thread. Please try again.');
              }
            }
          }
        ]
      };
    }
  }
  
  // Integration function remains the same
  export function initializeTwitterCommands(
    chatService: ChatService, 
    twitterService: TwitterService,
    jupiterService: JupiterPriceV2Service,
    aiService: AIService
  ): void {
    const twitterCommands = new TwitterCommands(
      chatService,
      twitterService,
      jupiterService,
      aiService
    );
    
    chatService.addCommands(twitterCommands.getTwitterCommands().commands || []);
  }