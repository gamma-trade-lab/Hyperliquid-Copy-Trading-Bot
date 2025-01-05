import { Connection, PublicKey } from '@solana/web3.js';
import { TwitterApi, TweetV2SingleStreamResult } from 'twitter-api-v2';
import { Client as DiscordClient, Message } from 'discord.js';
import Groq from "groq-sdk";
import { CONFIG } from './config/settings';
import { elizaLogger } from "@ai16z/eliza";
import { config } from 'dotenv';

// Import services
import { SocialService } from './services/social';
import { ContentUtils } from './utils/content';
import { Parser } from './utils/parser';
import { TradingService } from './services/blockchain/trading';
import { AIService } from './services/ai';

// Types
import { TokenInfo, MarketAnalysis, TradeResult, AgentCommand, CommandContext } from './services/blockchain/types';
import { SocialMetrics } from './services/social';

class MemeAgentInfluencer {
  private connection: Connection;
  private groq: Groq;
  private twitter: TwitterApi;
  private discord: DiscordClient;
  private aiService: AIService;
  private socialService: SocialService;
  private tradingService: TradingService;
  private tokenAddress: string;
  private isInitialized: boolean;

  constructor() {
    this.connection = new Connection(CONFIG.SOLANA.RPC_URL);
    this.groq = new Groq({ apiKey: CONFIG.AI.GROQ.API_KEY });
    this.twitter = new TwitterApi(CONFIG.SOCIAL.TWITTER.tokens);
    this.discord = new DiscordClient({
      intents: ["GuildMessages", "DirectMessages", "MessageContent"]
    });
    
    this.aiService = new AIService({
      groqApiKey: CONFIG.AI.GROQ.API_KEY,
      defaultModel: CONFIG.AI.GROQ.MODEL,
      maxTokens: CONFIG.AI.GROQ.MAX_TOKENS,
      temperature: CONFIG.AI.GROQ.DEFAULT_TEMPERATURE
    });

    this.socialService = new SocialService({
      services: {
        ai: this.aiService
      },
      discord: {
        token: CONFIG.SOCIAL.DISCORD.TOKEN,
        guildId: CONFIG.SOCIAL.DISCORD.GUILD_ID
      },
      twitter: CONFIG.SOCIAL.TWITTER
    });

    this.tradingService = new TradingService(CONFIG.SOLANA.RPC_URL);
    this.tokenAddress = '';
    this.isInitialized = false;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      elizaLogger.info('Initializing Meme Agent Influencer...');

      const tokenInfo = await this.createToken({
        name: CONFIG.SOLANA.TOKEN_SETTINGS.NAME,
        symbol: CONFIG.SOLANA.TOKEN_SETTINGS.SYMBOL,
        decimals: CONFIG.SOLANA.TOKEN_SETTINGS.DECIMALS,
        metadata: JSON.stringify(CONFIG.SOLANA.TOKEN_SETTINGS.METADATA)
      });

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

  private async createToken(tokenSettings: {
    name: string;
    symbol: string;
    decimals: number;
    metadata: string;
  }): Promise<{ mint: string }> {
    // Implement the logic to create a token and return its mint address
    const mintAddress = 'some-mint-address'; // Replace with actual mint address
    return { mint: mintAddress };
  }

  private async initializeServices(): Promise<void> {
    try {
      await this.socialService.initialize();
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
          add: [{ value: `@${CONFIG.SOCIAL.TWITTER.username}` }]
        });
      }

      const stream = await this.twitter.v2.searchStream({
        'tweet.fields': ['referenced_tweets', 'author_id'],
        expansions: ['referenced_tweets.id']
      });

      stream.on('data', async (tweet: TweetV2SingleStreamResult) => {
        try {
          const sentiment = await this.aiService.analyzeSentiment(tweet.data.text);
          if (sentiment > 0.5) {
            const response = await this.aiService.generateResponse({
              content: tweet.data.text,
              platform: 'twitter',
              author: tweet.data.author_id || 'unknown',
              channel: tweet.data.id
            });
            await this.twitter.v2.reply(response, tweet.data.id);
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

        await this.socialService.send(content);
      } catch (error) {
        elizaLogger.error('Content generation error:', error);
      }
    };

    await generateAndPost();
    setInterval(generateAndPost, CONFIG.AUTOMATION.CONTENT_GENERATION_INTERVAL);
  }

  private async startMarketMonitoring(): Promise<void> {
    const monitorMarket = async () => {
      try {
        const analysis = await this.analyzeMarket();
        const tradingConfig = CONFIG.SOLANA.TRADING;

        if (analysis.shouldTrade && analysis.confidence > tradingConfig.MIN_CONFIDENCE) {
          await this.executeTrade(analysis);
        }
      } catch (error) {
        elizaLogger.error('Market monitoring error:', error);
      }
    };

    await monitorMarket();
    setInterval(monitorMarket, CONFIG.AUTOMATION.MARKET_MONITORING_INTERVAL);
  }

  private async startCommunityEngagement(): Promise<void> {
    const engage = async () => {
      try {
        const metrics: SocialMetrics = await this.socialService.getCommunityMetrics();
        const content = await ContentUtils.generateContent({
          type: 'community',
          variables: {
            followers: metrics.followers.toString(),
            engagement: metrics.engagement.toString(),
            activity: metrics.activity
          }
        });

        await this.socialService.send(content);
      } catch (error) {
        elizaLogger.error('Community engagement error:', error);
      }
    };

    await engage();
    setInterval(engage, CONFIG.AUTOMATION.COMMUNITY_ENGAGEMENT_INTERVAL);
  }

  private async analyzeMarket(): Promise<MarketAnalysis> {
    const metrics = await this.tradingService.getMarketData(this.tokenAddress);
    const aiAnalysis = await this.aiService.analyzeMarket(metrics);
    
    // Return a properly formatted MarketAnalysis object
    return {
      shouldTrade: aiAnalysis.shouldTrade,
      confidence: aiAnalysis.confidence,
      action: aiAnalysis.action,
      metrics: aiAnalysis.metrics
    };
  }

  private async executeTrade(analysis: MarketAnalysis): Promise<TradeResult> {
    return await this.tradingService.executeTrade({
      inputMint: analysis.action === 'BUY' ? 'SOL' : this.tokenAddress,
      outputMint: analysis.action === 'BUY' ? this.tokenAddress : 'SOL',
      amount: this.calculateTradeAmount(analysis),
      slippage: CONFIG.SOLANA.TRADING.SLIPPAGE
    });
  }

  private async getCurrentPrice(): Promise<number> {
    return await this.tradingService.getTokenPrice(this.tokenAddress);
  }

  private calculateTradeAmount(analysis: MarketAnalysis): number {
    return CONFIG.SOLANA.TRADING.BASE_AMOUNT * analysis.confidence;
  }

  private async handleCommand(
    command: AgentCommand,
    context: CommandContext
  ): Promise<void> {
    try {
      const response = await this.generateCommandResponse(command, context);
      await this.socialService.sendMessage(context.platform, context.messageId, response);
    } catch (error) {
      elizaLogger.error('Command handling error:', error);
      await this.socialService.sendMessage(
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
        const metrics = await this.tradingService.getMarketData(this.tokenAddress);
        return `24h Volume: ${metrics.volume24h}\nMarket Cap: ${metrics.marketCap}`;
      default:
        return await this.aiService.generateResponse({
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

async function initializeSolanaConnection() {
  console.log('Initializing Solana connection...');
  try {
    const connection = new Connection(CONFIG.SOLANA.RPC_URL, 'confirmed');
    const version = await connection.getVersion();
    console.log('Solana connection established:', version);
    return connection;
  } catch (error) {
    console.error('Failed to connect to Solana:', error);
    throw error;
  }
}

async function validateWalletBalance(connection: Connection) {
  console.log('Checking wallet balance...');
  try {
    const publicKey = new PublicKey(CONFIG.SOLANA.PUBKEY);
    const balance = await connection.getBalance(publicKey);
    console.log('Wallet balance:', balance / 1e9, 'SOL');
    return balance;
  } catch (error) {
    console.error('Failed to check wallet balance:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('Meme Agent Starting...');
    console.log('Loading configuration...');
    config();

    // Log configuration (redact sensitive info)
    console.log('Configuration loaded:', {
      network: CONFIG.SOLANA.NETWORK,
      rpcUrl: CONFIG.SOLANA.RPC_URL,
      pubkey: CONFIG.SOLANA.PUBKEY
    });

    // Initialize Solana connection
    const connection = await initializeSolanaConnection();

    // Check wallet balance
    await validateWalletBalance(connection);

    console.log('Initialization complete!');
  } catch (error) {
    console.error('Fatal error during initialization:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export {
  MemeAgentInfluencer,
  type TokenInfo,
  type MarketAnalysis,
  type TradeResult,
  type AgentCommand,
  type CommandContext
};
