import { Connection, PublicKey } from '@solana/web3.js';
// Discord imports are optional
let DiscordClient, Message;
try {
  const discord = await import('discord.js');
  DiscordClient = discord.Client;
  Message = discord.Message;
} catch (error) {
  console.warn('Discord.js not available:', error);
}
import Groq from "groq-sdk";
import { CONFIG } from './config/settings';
import { elizaLogger } from "@ai16z/eliza";
import { config } from 'dotenv';

// Import services
import { SocialService } from './services/social';
import { ContentUtils } from './utils/content';
import { Parser } from './utils/parser';
import { TradingService } from './services/blockchain/trading';
import { AIService } from './services/ai/ai';
import { MarketTweetCron } from './services/social/MarketTweetCron';
import { TweetGenerator } from './services/ai/tweetGenerator';
import { AgentTwitterClientService } from './services/social/agentTwitterClient';

// Types
import { TokenInfo, TradeResult, AgentCommand, CommandContext } from './services/blockchain/types';
import { MarketData, MarketAnalysis } from './types/market';
import { SocialMetrics } from './services/social';
import { TwitterStreamHandler } from './services/social/TwitterStreamHandler';
import { TweetGenerationResult } from './services/ai/types';

class MemeAgentInfluencer {
  private connection: Connection;
  private groq: Groq;
  private twitterStreamHandler?: TwitterStreamHandler;
  private discord?: typeof DiscordClient;
  private aiService: AIService;
  public socialService: SocialService;
  private tradingService: TradingService;
  private tokenAddress: string;
  private isInitialized: boolean;

  constructor() {
    this.connection = new Connection(CONFIG.SOLANA.RPC_URL);
    this.groq = new Groq({ apiKey: CONFIG.AI.GROQ.API_KEY });
    // Discord is optional
    if (CONFIG.SOCIAL.DISCORD.TOKEN) {
      try {
        this.discord = new DiscordClient({
          intents: ["GuildMessages", "DirectMessages", "MessageContent"]
        });
      } catch (error) {
        console.warn('Failed to initialize Discord client:', error);
      }
    }
    
    this.aiService = new AIService({
      groqApiKey: CONFIG.AI.GROQ.API_KEY,
      defaultModel: CONFIG.AI.GROQ.MODEL,
      maxTokens: CONFIG.AI.GROQ.MAX_TOKENS,
      temperature: CONFIG.AI.GROQ.DEFAULT_TEMPERATURE
    });

    // Initialize social service with Twitter client
    const twitterClient = new AgentTwitterClientService(
      CONFIG.SOCIAL.TWITTER.username,
      CONFIG.SOCIAL.TWITTER.password,
      CONFIG.SOCIAL.TWITTER.email,
      this.aiService
    );
    
    this.socialService = new SocialService({
      services: {
        ai: this.aiService
      },
      discord: {
        token: CONFIG.SOCIAL.DISCORD.TOKEN,
        guildId: CONFIG.SOCIAL.DISCORD.GUILD_ID
      },
      twitterClient
    });

    this.tradingService = new TradingService(CONFIG.SOLANA.RPC_URL);
    this.tokenAddress = '';
    this.isInitialized = false;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      elizaLogger.info('Initializing Meme Agent Influencer...');
      
      // Initialize Twitter client
      const twitterClient = await this.socialService.getTwitterClient();
      if (!twitterClient) {
        throw new Error('Failed to initialize Twitter client');
      }
      elizaLogger.success('Twitter client initialized successfully');

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
    // Setup Discord message handling if available
    if (this.discord) {
      this.discord.on('messageCreate', async (message: typeof Message) => {
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
    }

    await this.setupTwitterStream();
  }

  private async setupTwitterStream(): Promise<void> {
    try {
      // Get Twitter client from social service
      const twitterClient = await this.socialService.getTwitterClient();
      
      if (twitterClient) {
        // Initialize Twitter stream handler
        this.twitterStreamHandler = new TwitterStreamHandler(
          twitterClient,
          this.aiService
        );
        
        try {
          await this.twitterStreamHandler.initialize();
          elizaLogger.success('Twitter stream handler initialized');
        } catch (streamError) {
          elizaLogger.error('Failed to initialize Twitter stream:', streamError);
          // Don't throw here - we want to continue even if stream fails
          return;
        }
      } else {
        elizaLogger.warn('Twitter stream setup skipped - no Twitter client available');
      }
    } catch (error) {
      elizaLogger.error('Error setting up Twitter stream:', error);
      throw error;
    }
  }

  public async startAutomation(): Promise<void> {
    await Promise.all([
      this.startContentGeneration(),
      this.startMarketMonitoring(),
      this.startCommunityEngagement()
    ]);

    // Initialize and start market tweet automation
    const twitterClient = await this.socialService.getTwitterClient();
    if (twitterClient) {
      const tweetGen = new TweetGenerator();
      const marketTweetCron = new MarketTweetCron(
        tweetGen,
        this.tradingService,
        twitterClient
      );
      marketTweetCron.start();
      elizaLogger.success('Market tweet automation started');
    } else {
      elizaLogger.warn('Market tweet automation skipped - no Twitter client available');
    }
  }

  private async startContentGeneration(): Promise<void> {
    const generateAndPost = async () => {
      try {
        // Get market analysis with proper error handling
        let marketAnalysis: MarketAnalysis;
        try {
          marketAnalysis = await this.analyzeMarket();
        } catch (error) {
          console.error('Failed to analyze market:', error);
          throw new Error('Market analysis failed: ' + (error as Error).message);
        }

        // Get social metrics with proper error handling
        let socialMetrics: SocialMetrics;
        try {
          socialMetrics = await this.socialService.getCommunityMetrics();
        } catch (error) {
          console.error('Failed to get community metrics:', error);
          throw new Error('Community metrics retrieval failed: ' + (error as Error).message);
        }
        
        // Map social metrics to community metrics format
        const communityMetrics = {
          totalFollowers: socialMetrics.followers || 0,
          activeUsers24h: Math.floor(socialMetrics.followers * (socialMetrics.engagement || 0)),
          sentimentScore: socialMetrics.activity === 'High' ? 0.8 : socialMetrics.activity === 'Medium' ? 0.5 : 0.2,
          topInfluencers: [] // Initialize empty for now
        };

        // Generate tweet using TweetGenerator with proper error handling
        const tweetGen = new TweetGenerator();
        let result: TweetGenerationResult;
        try {
          result = await tweetGen.generateTweetContent({
            marketData: marketAnalysis.metrics,
            communityMetrics,
            style: {
              tone: marketAnalysis.metrics.priceChange24h > 0 ? 'bullish' : 
                    marketAnalysis.metrics.priceChange24h < 0 ? 'bearish' : 'neutral',
              humor: 0.7,
              formality: 0.5
            },
            constraints: {
              maxLength: 280,
              includeTickers: true,
              includeMetrics: true
            }
          });
          console.log('Generated tweet content:', result.content);
        } catch (error) {
          console.error('Failed to generate tweet content:', error);
          throw new Error('Tweet generation failed: ' + (error as Error).message);
        }

        // Post tweet with proper error handling
        try {
          const postResult = await this.socialService.postTweet(result.content);
          if (!postResult.success) {
            throw postResult.error || new Error('Failed to post tweet');
          }
          console.log('Successfully posted tweet:', result.content);
        } catch (error) {
          console.error('Failed to post tweet:', error);
          throw new Error('Tweet posting failed: ' + (error as Error).message);
        }

        // Post to social media using Twitter client
        const twitterClient = await this.socialService.getTwitterClient();
        if (twitterClient) {
          const tweetResult = await twitterClient.postTweet(result.content);
          if (!tweetResult.success) {
            throw tweetResult.error || new Error('Failed to post tweet');
          }
          elizaLogger.success('Tweet posted successfully:', result.content);
        } else {
          elizaLogger.warn('Tweet generation succeeded but no Twitter client available');
        }
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
    try {
      const rawMetrics = await this.tradingService.getMarketData();
      const analysis = await this.aiService.analyzeMarket(rawMetrics);
      
      // Transform raw metrics into proper MarketData structure
      const metrics: MarketData = {
        price: rawMetrics.price || 0,
        volume24h: rawMetrics.volume24h || 0,
        marketCap: rawMetrics.marketCap || 0,
        priceChange24h: (rawMetrics as any).priceChange24h || 0,
        topHolders: Array.isArray((rawMetrics as any).topHolders) ? 
          (rawMetrics as any).topHolders.map((holder: any) => ({
            address: holder.address || '',
            balance: holder.balance || 0
          })) : []
      };

      return {
        shouldTrade: analysis.shouldTrade,
        confidence: analysis.confidence,
        action: analysis.action,
        metrics
      };
    } catch (error) {
      console.error('Error analyzing market:', error);
      return {
        shouldTrade: false,
        confidence: 0,
        action: 'HOLD',
        metrics: {
          price: 0,
          volume24h: 0,
          marketCap: 0,
          priceChange24h: 0,
          topHolders: []
        }
      };
    }
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
        const metrics = await this.tradingService.getMarketData();
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

  async getMarketStats(): Promise<MarketData> {
    return await this.tradingService.getMarketData();
  }

  async shutdown(): Promise<void> {
    try {
      // TODO: Add agent-twitter-client cleanup if needed
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
    const publicKey = new PublicKey(CONFIG.SOLANA.PUBLIC_KEY);
    const balance = await connection.getBalance(publicKey);
    console.log('Wallet balance:', balance / 1e9, 'SOL');
    return balance;
  } catch (error) {
    console.error('Failed to check wallet balance:', error);
    throw error;
  }
}

async function chooseMode(): Promise<'auto' | 'chat'> {
  console.log('\nChoose a mode (enter number or name):');
  console.log('1. chat    - Interactive chat mode');
  console.log('2. auto    - Autonomous action mode');
  
  return new Promise(async (resolve) => {
    const readline = (await import('readline')).createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question('Enter your choice (1/2): ', (choice: string) => {
      readline.close();
      const mode = choice === '1' || choice.toLowerCase() === 'chat' ? 'chat' : 'auto';
      console.log(`\nSelected mode: ${mode}`);
      resolve(mode);
    });
  });
}

async function promptUser(question: string): Promise<string> {
  return new Promise(async (resolve) => {
    const readline = (await import('readline')).createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question(question, (answer: string) => {
      readline.close();
      resolve(answer.trim());
    });
  });
}

async function promptTweet(): Promise<string> {
  console.log('\nTweet Guidelines:');
  console.log('- Maximum 280 characters');
  console.log('- Type "exit" to cancel');
  console.log('- Emojis are supported! 🚀\n');

  const tweet = await promptUser('Enter your tweet: ');
  
  if (tweet.length > 280) {
    console.warn('\nWarning: Tweet exceeds 280 characters. It will be truncated.');
    return tweet.slice(0, 280);
  }
  
  return tweet;
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
      pubkey: CONFIG.SOLANA.PUBLIC_KEY
    });

    // Initialize Solana connection
    const connection = await initializeSolanaConnection();

    // Check wallet balance
    await validateWalletBalance(connection);

    // Initialize agent
    const agent = new MemeAgentInfluencer();
    await agent.initialize();

    // Choose operation mode
    const mode = await chooseMode();

    if (mode === 'auto') {
      console.log('Starting autonomous mode...');
      await agent.startAutomation();
    } else {
      console.log('Starting interactive chat mode...');
      while (true) {
        console.log('\nWhat would you like to do?');
        console.log('1. Post a tweet');
        console.log('2. View market stats');
        console.log('3. Exit');
        
        const choice = await promptUser('Enter your choice (1-3): ');
        
        if (choice === '3' || choice.toLowerCase() === 'exit') {
          console.log('Exiting chat mode...');
          break;
        }
        
        switch (choice) {
          case '1':
            try {
              const tweet = await promptTweet();
              if (tweet.toLowerCase() === 'exit') continue;
              
              const twitterClient = await agent.socialService.getTwitterClient();
              if (!twitterClient) {
                console.error('No Twitter client available');
                continue;
              }
              
              const result = await twitterClient.postTweet(tweet);
              if (!result.success) {
                throw result.error || new Error('Failed to post tweet');
              }
              console.log('\nTweet posted successfully! 🎉');
              console.log('Content:', tweet);
            } catch (error) {
              console.error('Failed to post tweet:', error);
            }
            break;
            
          case '2':
            try {
              const marketData = await agent.getMarketStats();
              console.log('\nCurrent Market Stats:');
              console.log('Price:', marketData.price.toFixed(4), 'SOL');
              console.log('24h Volume:', marketData.volume24h.toFixed(2));
              console.log('24h Change:', marketData.priceChange24h.toFixed(2), '%');
            } catch (error) {
              console.error('Failed to fetch market stats:', error);
            }
            break;
            
          default:
            console.log('Invalid choice. Please try again.');
        }
      }
    }

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
