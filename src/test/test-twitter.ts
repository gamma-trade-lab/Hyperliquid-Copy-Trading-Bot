import { TwitterService } from '../services/social/twitter.js';
import { IAIService, Tweet } from '../services/ai/types.js';
import { MarketAction } from '../config/constants.js';
import { Character } from '../personality/types.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const mockAIService: IAIService = {
  generateResponse: async (params: { content: string; author: string; channel?: string; platform: string }) => 
    'Mock response',
  
  generateMarketUpdate: async (params: { action: MarketAction; data: any; platform: string }) => 
    'Mock market update',
  
  generateMarketAnalysis: async () => 
    'Mock market analysis',
  
  shouldEngageWithContent: async (params: { text: string; author: string; platform: string }) => 
    true,
  
  determineEngagementAction: async (tweet: Tweet) => ({
    type: 'like',
    content: 'Mock engagement response'
  }),

  analyzeMarket: async (data: any) => ({
    shouldTrade: true,
    confidence: 0.8,
    action: 'BUY',
    metrics: data
  }),

  setCharacterConfig: async (config: Character) => {
    // Mock implementation
  }
};

async function testTwitterLogin() {
  const twitter = new TwitterService({
    credentials: {
      username: process.env.TWITTER_USERNAME!,
      password: process.env.TWITTER_PASSWORD!,
      email: process.env.TWITTER_EMAIL!
    },
    aiService: mockAIService
  });

  try {
    console.log('Starting Twitter authentication test...');
    
    // Test initialization and login
    await twitter.initialize();
    console.log('✓ Twitter login successful!');
    
    // Test basic tweet functionality
    console.log('Attempting to send test tweet...');
    const tweetId = await twitter.tweet('hello world');
    console.log(`✓ Test tweet sent successfully! Tweet ID: ${tweetId}`);
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    try {
      await twitter.cleanup();
      console.log('✓ Cleanup completed');
    } catch (cleanupError) {
      console.error('❌ Cleanup failed:', cleanupError);
    }
  }
}

// Run the test
testTwitterLogin()
  .then(() => {
    console.log('🎉 All tests passed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Tests failed:', error);
    process.exit(1);
  });
