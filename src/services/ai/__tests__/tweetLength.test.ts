import { TweetGenerator } from '../tweetGenerator.js';
import { expect, describe, it, jest, beforeEach } from '@jest/globals';
import { MarketData, TweetGenerationResult } from '../types.js';

describe('Tweet Length Validation', () => {
  let generator: TweetGenerator;
  const mockMarketData: MarketData = {
    price: 100,
    volume24h: 1000000,
    marketCap: 10000000,
    priceChange24h: 0,
    topHolders: []
  };

  beforeEach(() => {
    generator = new TweetGenerator();
    jest.clearAllMocks();
  });

  it('should handle tweets within length limit', async () => {
    const mockResponse = 'This is a short tweet #Crypto';
    jest.spyOn(generator['groqService'], 'generateTweet').mockResolvedValueOnce(mockResponse);

    const result = await generator.generateTweetContent({
      marketData: mockMarketData,
      constraints: { maxLength: 280, includeTickers: false, includeMetrics: false }
    });

    expect(result.content.length).toBeLessThanOrEqual(280);
    expect(result.content).toBe(mockResponse);
  });

  it('should truncate long tweets when truncateIfNeeded is true', async () => {
    const longTweet = 'A'.repeat(270) + ' #BTC #Crypto';
    jest.spyOn(generator['groqService'], 'generateTweet').mockResolvedValueOnce(longTweet);

    const result = await generator.generateTweetContent({
      marketData: mockMarketData,
      constraints: { 
        maxLength: 280, 
        includeTickers: false, 
        includeMetrics: false,
        truncateIfNeeded: true 
      }
    });

    expect(result.content.length).toBeLessThanOrEqual(280);
    expect(result.content).toMatch(/#BTC/);
    expect(result.content).toMatch(/#Crypto/);
    expect(result.metadata.context.truncated).toBe(true);
  });

  it('should preserve important context when truncating', async () => {
    const contextualTweet = `Price Update: ${('A'.repeat(250))} is now $100! #Crypto`;
    jest.spyOn(generator['groqService'], 'generateTweet').mockResolvedValueOnce(contextualTweet);

    const result = await generator.generateTweetContent({
      marketData: mockMarketData,
      constraints: { 
        maxLength: 280, 
        includeTickers: true, 
        includeMetrics: true,
        truncateIfNeeded: true 
      }
    });

    expect(result.content.length).toBeLessThanOrEqual(280);
    expect(result.content).toMatch(/^Price Update:/);
    expect(result.content).toMatch(/#Crypto/);
  });

  it('should throw error for long tweets when truncateIfNeeded is false', async () => {
    const longTweet = 'A'.repeat(300);
    jest.spyOn(generator['groqService'], 'generateTweet').mockResolvedValueOnce(longTweet);

    await expect(generator.generateTweetContent({
      marketData: mockMarketData,
      constraints: { 
        maxLength: 280, 
        includeTickers: false, 
        includeMetrics: false,
        truncateIfNeeded: false 
      }
    })).rejects.toThrow('Generated content exceeds tweet length limit');
  });

  it('should handle tweets with emojis correctly', async () => {
    const tweetWithEmojis = `Market Update 📊 ${('A'.repeat(240))} 🚀🌙 #Crypto`;
    jest.spyOn(generator['groqService'], 'generateTweet').mockResolvedValueOnce(tweetWithEmojis);

    const result = await generator.generateTweetContent({
      marketData: mockMarketData,
      constraints: { 
        maxLength: 280, 
        includeTickers: true, 
        includeMetrics: true,
        truncateIfNeeded: true 
      }
    });

    expect(result.content.length).toBeLessThanOrEqual(280);
    expect(result.content).toMatch(/Market Update 📊/);
    expect(result.content).toMatch(/🚀|🌙/);
  });
});
