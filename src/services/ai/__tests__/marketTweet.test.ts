import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { TweetGenerator } from '../tweetGenerator';
import { MarketData } from '../types';

describe('Market Tweet Generation', () => {
  let generator: TweetGenerator;
  const mockMarketData: MarketData = {
    price: 100,
    volume24h: 1000000,
    marketCap: 10000000,
    priceChange24h: 5.5,
    topHolders: [
      { address: 'dummy1', balance: 1000 },
      { address: 'dummy2', balance: 500 }
    ]
  };

  beforeEach(() => {
    generator = new TweetGenerator();
    jest.clearAllMocks();
  });

  it('should generate market update tweet with metrics', async () => {
    const mockResponse = 'Price Update: $MEME at $100 (+5.5%) 📈 Volume: $1M #Crypto';
    jest.spyOn(generator['groqService'], 'generateTweet').mockResolvedValueOnce(mockResponse);

    const result = await generator.generateTweetContent({
      marketData: mockMarketData,
      constraints: { 
        maxLength: 280,
        includeTickers: true,
        includeMetrics: true
      }
    });

    expect(result.content).toBe(mockResponse);
    expect(result.metadata.context.marketCondition).toBe('bullish');
  });

  it('should generate market thread for detailed updates', async () => {
    const mockThread = [
      'Thread: $MEME Market Analysis 🧵',
      'Price: $100 (+5.5%) 📈',
      'Volume: $1M in 24h 📊'
    ];
    jest.spyOn(generator['groqService'], 'generateThreadFromMarketData').mockResolvedValueOnce(mockThread);

    const thread = await generator.generateThreadFromMarketUpdate(mockMarketData);
    expect(thread).toHaveLength(3);
    expect(thread[0]).toContain('Thread');
    expect(thread[1]).toContain('Price');
    expect(thread[2]).toContain('Volume');
  });

  it('should handle bearish market conditions', async () => {
    const bearishData = {
      ...mockMarketData,
      priceChange24h: -6.5
    };
    const mockResponse = 'Price Alert: $MEME down -6.5% to $100 📉 Stay calm and DYOR';
    jest.spyOn(generator['groqService'], 'generateTweet').mockResolvedValueOnce(mockResponse);

    const result = await generator.generateTweetContent({
      marketData: bearishData,
      constraints: {
        maxLength: 280,
        includeTickers: true,
        includeMetrics: true
      }
    });

    expect(result.content).toBe(mockResponse);
    expect(result.metadata.context.marketCondition).toBe('bearish');
  });

  it('should handle neutral market conditions', async () => {
    const neutralData = {
      ...mockMarketData,
      priceChange24h: 2.5
    };
    const mockResponse = '$MEME holding steady at $100 (2.5%) 🎯';
    jest.spyOn(generator['groqService'], 'generateTweet').mockResolvedValueOnce(mockResponse);

    const result = await generator.generateTweetContent({
      marketData: neutralData,
      constraints: {
        maxLength: 280,
        includeTickers: true,
        includeMetrics: true
      }
    });

    expect(result.content).toBe(mockResponse);
    expect(result.metadata.context.marketCondition).toBe('neutral');
  });
});
