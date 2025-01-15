import { JupiterPriceV2 } from '../blockchain/defi/jupiterPriceV2.js';
import { HumanMessage } from "@langchain/core/messages";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { MemorySaver } from "@langchain/langgraph";
import { CONFIG } from '../../config/settings.js';
import { elizaLogger } from "@ai16z/eliza";
import Groq from "groq-sdk";
import { TwitterService } from '../social/twitter.js';
import { AIService } from '../ai.js';
import { TradingService } from '../blockchain/trading.js';
import { JupiterPriceV2Service } from '../blockchain/defi/JupiterPriceV2Service.js';

interface AgentConfig {
  configurable: {
    thread_id: string;
  };
}

interface AgentTools {
  jupiter: JupiterPriceV2Service;
  trading: TradingService;
  twitter: TwitterService;
}

export class PersistentAgent {
  private groq: Groq;
  private checkpointer: PostgresSaver;
  private tools: AgentTools;
  private aiService: AIService;
  private config: AgentConfig;

  constructor(
    groqApiKey: string,
    postgresUrl: string,
    tools: AgentTools,
    aiService: AIService
  ) {
    this.groq = new Groq({ apiKey: groqApiKey });
    this.checkpointer = PostgresSaver.fromConnString(postgresUrl);
    this.tools = tools;
    this.aiService = aiService;
    this.config = {
      configurable: {
        thread_id: "JENNA_v1"
      }
    };
  }

  private validateEnvironment(): void {
    const requiredVars = [
      'GROQ_API_KEY',
      'POSTGRES_URL',
      'TWITTER_API_KEY',
      'TWITTER_API_SECRET',
      'TWITTER_ACCESS_TOKEN',
      'TWITTER_ACCESS_SECRET'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      elizaLogger.error('Missing required environment variables:', missingVars);
      throw new Error(`Required environment variables not set: ${missingVars.join(', ')}`);
    }
  }

  async initialize(): Promise<void> {
    try {
      this.validateEnvironment();
      await this.checkpointer.setup();
      elizaLogger.success('Agent initialized successfully');
    } catch (error) {
      elizaLogger.error('Failed to initialize agent:', error);
      throw error;
    }
  }

  async runAutonomousMode(interval = CONFIG.AUTOMATION.CONTENT_GENERATION_INTERVAL): Promise<void> {
    elizaLogger.info('Starting autonomous mode...');

    while (true) {
      try {
        // Generate market analysis
        const marketAnalysis = await this.tools.jupiter.getPriceData();
        
        // Generate AI content based on market data
        const content = await this.aiService.generateResponse({
          content: `Market Update: ${JSON.stringify(marketAnalysis)}`,
          platform: 'twitter',
          author: '',
          messageId: ''
        });

        // Post to Twitter
        await this.tools.twitter.tweet(content, {});

        // Log success and wait for next interval
        elizaLogger.success('Autonomous action completed successfully');
        await new Promise(resolve => setTimeout(resolve, interval));

      } catch (error) {
        elizaLogger.error('Error in autonomous mode:', error);
        await new Promise(resolve => setTimeout(resolve, CONFIG.AUTOMATION.CONTENT_GENERATION_INTERVAL));
      }
    }
  }

  async runChatMode(): Promise<void> {
    elizaLogger.info('Starting chat mode...');

    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    while (true) {
      try {
        const input = await new Promise<string>(resolve => {
          rl.question('\nEnter command (type "exit" to quit): ', resolve);
        });

        if (input.toLowerCase() === 'exit') {
          break;
        }

        // Process the command through Groq
        const response = await this.groq.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: CONFIG.AI.GROQ.SYSTEM_PROMPTS.MARKET_ANALYSIS
            },
            {
              role: 'user',
              content: input
            }
          ],
          model: CONFIG.AI.GROQ.MODEL,
          temperature: CONFIG.AI.GROQ.DEFAULT_TEMPERATURE
        });

        const message = response.choices[0]?.message?.content;
        if (message) {
          console.log('\nJENNA:', message);
        }

      } catch (error) {
        elizaLogger.error('Error in chat mode:', error);
      }
    }

    rl.close();
  }

  async chooseMode(): Promise<'chat' | 'auto'> {
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    while (true) {
      console.log('\nAvailable modes:');
      console.log('1. chat    - Interactive chat mode');
      console.log('2. auto    - Autonomous trading & social mode');

      const choice = await new Promise<string>(resolve => {
        rl.question('\nChoose mode (enter number or name): ', resolve);
      });

      rl.close();

      if (choice === '1' || choice.toLowerCase() === 'chat') {
        return 'chat';
      }
      if (choice === '2' || choice.toLowerCase() === 'auto') {
        return 'auto';
      }

      console.log('Invalid choice. Please try again.');
    }
  }

  async start(): Promise<void> {
    try {
      await this.initialize();
      const mode = await this.chooseMode();

      if (mode === 'chat') {
        await this.runChatMode();
      } else {
        await this.runAutonomousMode();
      }

    } catch (error) {
      elizaLogger.error('Fatal error:', error);
      throw error;
    }
  }
}

// Export factory function for easy instantiation
export const createPersistentAgent = async (
  tools: AgentTools,
  aiService: AIService
): Promise<PersistentAgent> => {
  const groqApiKey = process.env.GROQ_API_KEY;
  const postgresUrl = process.env.POSTGRES_URL;

  if (!groqApiKey || !postgresUrl) {
    throw new Error('Missing required environment variables: GROQ_API_KEY or POSTGRES_URL');
  }

  return new PersistentAgent(groqApiKey, postgresUrl, tools, aiService);
};