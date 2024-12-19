// src/index.ts

import { SolanaAgentKit, createSolanaTools } from 'solana-agent-kit';
import { TwitterApi } from 'twitter-api-v2';
import { Client as DiscordClient, Message } from 'discord.js';
import Groq from "groq-sdk";
import { CONFIG } from './config/settings';
import { elizaLogger } from "@ai16z/eliza";

// Import services
import { AIService } from './services/ai';
import { SocialService } from './services/social';
import { ContentUtils } from './utils/content';
import { Parser } from './utils/parser';
import { TradingService } from './services/blockchain/trading';

// Types
interface TokenInfo {
  mint: string;
  decimals: number;
  supply: number;
  metadata: {
    description: string;
    image: string;
  };
}

interface MarketAnalysis {
  shouldTrade: boolean;
  confidence: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  metrics?: {
    price: number;
    volume24h: number;
    marketCap: number;
  };
}

interface TradeResult {
  success: boolean;
  signature?: string;
  error?: string;
}

interface AgentCommand {
  type: string;
  command: string;
  raw: string;
  params?: Record<string, any>;
}

interface CommandContext {
  platform: string;
  channelId: string;
  messageId: string;
  author: string;
}

// Initialize services
const aiService = new AIService();

const socialService = new SocialService({
  services: {
    ai: aiService
  },
  discord: {
    token: CONFIG.SOCIAL.DISCORD.TOKEN,
    guildId: CONFIG.SOCIAL.DISCORD.GUILD_ID
  }
});

const tradingService = new TradingService(CONFIG.SOLANA);

// Main Agent Class
class MemeAgentInfluencer {
  private solanaKit: SolanaAgentKit;
  private solanaTools: ReturnType<typeof createSolanaTools>;
  private groq: Groq;
  private twitter: TwitterApi;
  private discord: DiscordClient;
  private tokenAddress: string;
  private isInitialized: boolean;

  constructor() {
    this.solanaKit = new SolanaAgentKit(
      CONFIG.SOLANA.PRIVATE_KEY, 
      CONFIG.SOLANA.RPC_URL, 
      CONFIG.SOLANA.NETWORK
    );
    this.solanaTools = createSolanaTools(this.solanaKit);
    this.groq = new Groq({ apiKey: CONFIG.AI.GROQ.API_KEY });
    this.twitter = new TwitterApi(CONFIG.SOCIAL.TWITTER.tokens);
    this.discord = new DiscordClient({
      intents: ["GuildMessages", "DirectMessages", "MessageContent"]
    });
    this.tokenAddress = '';
    this.isInitialized = false;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      elizaLogger.info('Initializing Meme Agent Influencer...');

      const tokenInfo = await this.solanaKit.createPumpFunToken(
        CONFIG.SOLANA.TOKEN_SETTINGS.NAME,
        CONFIG.SOLANA.TOKEN_SETTINGS.SYMBOL,
        CONFIG.SOLANA.TOKEN_SETTINGS.METADATA.description,
        CONFIG.SOLANA.TOKEN_SETTINGS.METADATA.image
      );

      this.tokenAddress = tokenInfo.mint;
      elizaLogger.success('Token launched:', this.tokenAddress);

      await this.initializeServices();
      await this.startAutomation();

      this.isInitialized = true;
      elizaLogger.success('Meme Agent Influencer initialized successfully!');
    } catch (error) {
      elizaLogger.error('Initialization failed:', error);
      throw error;
    }
  }

  private async initializeServices(): Promise<void> {
    try {
      await socialService.initialize();
      elizaLogger.success('Social service initialized');

      await this.setupMessageHandling();
      elizaLogger.success('Message handling initialized');
    } catch (error) {
      elizaLogger.error('Service initialization failed:', error);
      throw error;
    }
  }

  private async setupMessageHandling(): Promise<void> {
    this.discord.on('messageCreate', async (message: Message) => {
      if (message.author.bot) return;

      try {
        const parsedCommand = Parser.parseCommand(message.content);
        if (!parsedCommand) return;

        const command: AgentCommand = {
          ...parsedCommand,
          type: parsedCommand.command,
          raw: message.content
        };

        await this.handleCommand(command, {
          platform: 'discord',
          channelId: message.channel.id,
          messageId: message.id,
          author: message.author.tag
        });
      } catch (error) {
        elizaLogger.error('Error handling Discord command:', error);
        await message.reply('Sorry, there was an error processing your command.');
      }
    });

    await this.setupTwitterStream();
  }

  private async setupTwitterStream(): Promise<void> {
    try {
      const rules = await this.twitter.v2.streamRules();
      if (!rules.data?.length) {
        await this.twitter.v2.updateStreamRules({
          add: [{ value: `@${CONFIG.SOCIAL.TWITTER.USERNAME}` }]
        });
      }

      const stream = await this.twitter.v2.searchStream({
        'tweet.fields': ['referenced_tweets', 'author_id'],
        expansions: ['referenced_tweets.id']
      });

      stream.on('data', async tweet => {
        try {
          const sentiment = await aiService.analyzeSentiment(tweet.text);
          if (sentiment > 0.5) {
            const response = await aiService.generateResponse({
              content: tweet.text,
              platform: 'twitter',
              author: tweet.author_id || 'unknown',
              channel: tweet.id
            });
            await this.twitter.v2.reply(response, tweet.id);
          }
        } catch (error) {
          elizaLogger.error('Error handling tweet:', error);
        }
      });
    } catch (error) {
      elizaLogger.error('Error setting up Twitter stream:', error);
    }
  }

  private async startAutomation(): Promise<void> {
    await Promise.all([
      this.startContentGeneration(),
      this.startMarketMonitoring(),
      this.startCommunityEngagement()
    ]);
  }

  private async startContentGeneration(): Promise<void> {
    const generateAndPost = async () => {
      try {
        const content = await ContentUtils.generateContent({
          type: 'market_update',
          variables: {
            tokenName: CONFIG.SOLANA.TOKEN_SETTINGS.NAME,
            tokenAddress: this.tokenAddress,
            price: await this.getCurrentPrice()
          }
        });

        await socialService.send(content);
      } catch (error) {
        elizaLogger.error('Content generation error:', error);
      }
    };

    await generateAndPost();
    setInterval(generateAndPost, CONFIG.SOCIAL.POSTING_INTERVAL);
  }

  private async startMarketMonitoring(): Promise<void> {
    const monitorMarket = async () => {
      try {
        const analysis = await this.analyzeMarket();
        if (analysis.shouldTrade && analysis.confidence > CONFIG.TRADING.MIN_CONFIDENCE) {
          await this.executeTrade(analysis);
        }
      } catch (error) {
        elizaLogger.error('Market monitoring error:', error);
      }
    };

    await monitorMarket();
    setInterval(monitorMarket, CONFIG.TRADING.UPDATE_INTERVAL);
  }

  private async startCommunityEngagement(): Promise<void> {
    const engage = async () => {
      try {
        const metrics = await socialService.getCommunityMetrics();
        const content = await ContentUtils.generateContent({
          type: 'community',
          variables: {
            followers: metrics.followers.toString(),
            engagement: metrics.engagement.toString(),
            activity: metrics.activity
          }
        });

        await socialService.send(content);
      } catch (error) {
        elizaLogger.error('Community engagement error:', error);
      }
    };

    await engage();
    setInterval(engage, CONFIG.SOCIAL.ENGAGEMENT_INTERVAL);
  }

  private async analyzeMarket(): Promise<MarketAnalysis> {
    const metrics = await tradingService.getMarketData(this.tokenAddress);
    return await aiService.analyzeMarket(metrics);
  }

  private async executeTrade(analysis: MarketAnalysis): Promise<TradeResult> {
    return await tradingService.executeTrade({
      inputMint: analysis.action === 'BUY' ? 'SOL' : this.tokenAddress,
      outputMint: analysis.action === 'BUY' ? this.tokenAddress : 'SOL',
      amount: this.calculateTradeAmount(analysis),
      slippage: CONFIG.TRADING.SLIPPAGE
    });
  }

  private async getCurrentPrice(): Promise<number> {
    return await tradingService.getTokenPrice(this.tokenAddress);
  }

  private calculateTradeAmount(analysis: MarketAnalysis): number {
    return CONFIG.TRADING.BASE_AMOUNT * analysis.confidence;
  }

  private async handleCommand(
    command: AgentCommand,
    context: CommandContext
  ): Promise<void> {
    try {
      const response = await this.generateCommandResponse(command, context);
      await socialService.sendMessage(context.platform, context.messageId, response);
    } catch (error) {
      elizaLogger.error('Command handling error:', error);
      await socialService.sendMessage(
        context.platform,
        context.messageId,
        'Sorry, there was an error processing your command.'
      );
    }
  }

  private async generateCommandResponse(
    command: AgentCommand,
    context: CommandContext
  ): Promise<string> {
    switch (command.type) {
      case 'price':
        const price = await this.getCurrentPrice();
        return `Current price: ${price} SOL`;
      case 'stats':
        const metrics = await tradingService.getMarketData(this.tokenAddress);
        return `24h Volume: ${metrics.volume24h}\nMarket Cap: ${metrics.marketCap}`;
      default:
        return await aiService.generateResponse({
          content: command.raw,
          platform: context.platform,
          author: context.author,
          channel: context.channelId
        });
    }
  }

  async shutdown(): Promise<void> {
    try {
      await this.twitter.v2.updateStreamRules({
        delete: { ids: ['*'] }
      });
      this.discord.destroy();
      this.isInitialized = false;
      elizaLogger.success('Agent shutdown complete');
    } catch (error) {
      elizaLogger.error('Error during shutdown:', error);
      throw error;
    }
  }
}

export {
  MemeAgentInfluencer,
  type TokenInfo,
  type MarketAnalysis,
  type TradeResult,
  type AgentCommand,
  type CommandContext
};