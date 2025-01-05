import { AIService } from './src/services/ai/ai';
import { TwitterService } from './src/services/social/twitter';
import { Platform } from './src/personality/traits/responsePatterns';
import dotenv from 'dotenv';
dotenv.config();

// Verify environment variables
const requiredEnvVars = {
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  TWITTER_USERNAME: process.env.TWITTER_USERNAME,
  TWITTER_PASSWORD: process.env.TWITTER_PASSWORD,
  TWITTER_EMAIL: process.env.TWITTER_EMAIL
};

// Check for missing environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

async function testTwitterIntegration() {
  try {
    // Initialize AI Service with DeepSeek
    const aiService = new AIService({
      useDeepSeek: true,
      deepSeekApiKey: process.env.DEEPSEEK_API_KEY,
      defaultModel: 'deepseek-chat',
      maxTokens: 280,
      temperature: 0.7
    });

    // Initialize Twitter Service
    const twitterService = new TwitterService({
      credentials: {
        username: process.env.TWITTER_USERNAME!,
        password: process.env.TWITTER_PASSWORD!,
        email: process.env.TWITTER_EMAIL!
      },
      aiService
    });

    console.log('Initializing Twitter service...');
    await twitterService.initialize();
    console.log('Twitter login successful!');

    // Send test tweet
    console.log('Sending test tweet: "hello world"...');
    const tweetId = await twitterService.tweet('hello world');
    console.log(`Test tweet sent successfully! Tweet ID: ${tweetId}`);

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testTwitterIntegration();
