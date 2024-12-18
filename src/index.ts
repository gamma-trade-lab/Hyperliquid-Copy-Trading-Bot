import { SolanaAgentKit, createSolanaTools } from 'solana-agent-kit';
import { TwitterApi } from 'twitter-api-v2';
import { Client as DiscordClient, Message } from 'discord.js';
import { PublicKey } from '@solana/web3.js';
import Groq from "groq-sdk";
import { CONFIG } from './config/settings';

// Import services
import { AIService } from './services/ai';
import { SocialService } from './services/social';
import { ContentUtils } from './utils/content';
import { Parser } from './utils/parser';

// Import eliza and plugins
import {
  DbCacheAdapter,
  ICacheManager,
  IDatabaseCacheAdapter,
  stringToUuid,
  AgentRuntime,
  CacheManager,
  Character,
  IAgentRuntime,
  ModelProviderName,
  elizaLogger,
  IDatabaseAdapter,
} from "@ai16z/eliza";

import { PostgresDatabaseAdapter } from "@ai16z/adapter-postgres";
import { SqliteDatabaseAdapter } from "@ai16z/adapter-sqlite";
import { DirectClientInterface, DirectClient } from "@ai16z/client-direct";
import { DiscordClientInterface } from "@ai16z/client-discord";
import { TwitterClientInterface } from "@ai16z/client-twitter";
import { bootstrapPlugin } from "@ai16z/plugin-bootstrap";
import { solanaPlugin } from "@ai16z/plugin-solana";
import { nodePlugin } from "@ai16z/plugin-node";

// Node imports
import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";

// Initialize services
const aiService = new AIService();
const socialService = new SocialService({
  twitter: CONFIG.SOCIAL.TWITTER,
  discord: CONFIG.SOCIAL.DISCORD
});
// Utility function for random delays between actions
export const wait = (minTime: number = 1000, maxTime: number = 3000) => {
  const waitTime = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
  return new Promise((resolve) => setTimeout(resolve, waitTime));
};


interface DatabaseConfig {
  type: 'postgres' | 'sqlite';
  postgres?: {
    connectionString: string;
  };
  sqlite?: {
    filename: string;
  };
}

interface ClientConfig {
  enabled: boolean;
  settings?: Record<string, any>;
}

interface Settings {
  database: DatabaseConfig;
  clients: {
    direct: ClientConfig;
    discord: ClientConfig;
    twitter: ClientConfig;
  };
}

interface TradeTransaction {
  tokenAddress?: string;
  amount: number;
  slippage?: number;
}

interface MarketAnalysis {
  shouldTrade: boolean;
  confidence: number;
}

// Main Agent Class
class MemeAgentInfluencer {
    private solanaKit: SolanaAgentKit;
    private solanaTools: any;
    private groq: Groq;
    private twitter: TwitterApi;
    private discord: DiscordClient;
    private tokenAddress: string;
    private isInitialized: boolean = false;

    constructor() {
        this.solanaKit = new SolanaAgentKit(
            CONFIG.SOLANA.PRIVATE_KEY,
            CONFIG.SOLANA.RPC_URL,
            CONFIG.AI.GROQ.API_KEY
        );
        this.solanaTools = createSolanaTools(this.solanaKit);
        this.groq = new Groq({ apiKey: CONFIG.AI.GROQ.API_KEY });
        this.twitter = new TwitterApi(CONFIG.SOCIAL.TWITTER.API_KEY);
        this.discord = new DiscordClient({
            intents: ["GuildMessages", "DirectMessages", "MessageContent"]
        });
        this.tokenAddress = '';
    }

    async initialize() {
        if (this.isInitialized) return;
        
        try {
            console.log('Initializing Meme Agent Influencer...');

            // Launch token
            const tokenInfo = await this.launchToken();
            this.tokenAddress = tokenInfo.mint;
            console.log('Token launched:', this.tokenAddress);

            // Initialize services
            await this.initializeServices();

            // Start automation
            await this.startAutomation();

            this.isInitialized = true;
            console.log('Meme Agent Influencer initialized successfully!');
        } catch (error) {
            console.error('Initialization failed:', error);
            throw error;
        }
    }

    private async launchToken() {
        return await this.solanaKit.launchPumpFunToken(
            CONFIG.SOLANA.TOKEN_SETTINGS.NAME,
            CONFIG.SOLANA.TOKEN_SETTINGS.SYMBOL,
            CONFIG.SOLANA.TOKEN_SETTINGS.METADATA.description,
            CONFIG.SOLANA.TOKEN_SETTINGS.METADATA.image,
            {}
        );
    }

    private async initializeServices() {
        try {
            // Initialize social service
            await socialService.initialize();
            console.log('Social service initialized');

            // Setup message handling
            await this.setupMessageHandling();
            console.log('Message handling initialized');
        } catch (error) {
            console.error('Service initialization failed:', error);
            throw error;
        }
    }

    private async startAutomation() {
        try {
            // Start content generation
            this.startContentGeneration();
            console.log('Content generation started');

            // Start market monitoring
            this.startMarketMonitoring();
            console.log('Market monitoring started');

            // Start community engagement
            this.startCommunityEngagement();
            console.log('Community engagement started');
        } catch (error) {
            console.error('Automation startup failed:', error);
            throw error;
        }
    }

    private async setupMessageHandling() {
        // Discord message handling
        this.discord.on('messageCreate', async (message: Message) => {
            if (message.author.bot) return;

            try {
                const parsedCommand = Parser.parseCommand(message.content);
                if (!parsedCommand) return;

                await this.handleCommand(parsedCommand, message);
            } catch (error) {
                console.error('Error handling command:', error);
                await message.reply('Sorry, there was an error processing your command.');
            }
        });

        // Twitter stream handling
        await this.setupTwitterStream();
    }

    // src/index.ts - Part 3: MemeAgentInfluencer Core Methods

    private async setupTwitterStream() {
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
                  if (sentiment.score > 0.5) { // Only respond to positive/neutral tweets
                      const response = await aiService.generateResponse({
                          content: tweet.text,
                          platform: 'twitter',
                          author: tweet.author_id || 'unknown',
                          channel: tweet.id
                      });
                      await this.twitter.v2.reply(response, tweet.id);
                  }
              } catch (error) {
                  console.error('Error handling tweet:', error);
              }
          });
      } catch (error) {
          console.error('Error setting up Twitter stream:', error);
      }
  }

  private async startContentGeneration() {
      const generateAndPost = async () => {
          try {
              const content = await ContentUtils.generateContent({
                  type: 'meme',
                  platform: 'twitter',
                  context: {
                      tokenAddress: this.tokenAddress,
                      tokenName: CONFIG.SOLANA.TOKEN_SETTINGS.NAME
                  }
              });
              await socialService.broadcast(content);
          } catch (error) {
              console.error('Error in content generation:', error);
          }
      };

      // Initial post
      await generateAndPost();
      
      // Schedule regular posts
      setInterval(generateAndPost, CONFIG.SOCIAL.TWITTER.POSTING_INTERVAL);
  }

  private async startMarketMonitoring() {
      const checkMarket = async () => {
          try {
              const metrics = await tradingService.getMarketData(this.tokenAddress);
              const analysis: MarketAnalysis = await aiService.analyzeMarket(metrics);

              if (analysis.shouldTrade && analysis.confidence > CONFIG.TRADING.CONFIDENCE_THRESHOLD) {
                  await this.handleTradingOpportunity(analysis);
                  
                  // Announce trading action
                  const content = await ContentUtils.generateContent({
                      type: 'trade_update',
                      variables: {
                          action: analysis.shouldTrade ? 'buy' : 'sell',
                          confidence: analysis.confidence
                      }
                  });
                  await socialService.broadcast(content);
              }
          } catch (error) {
              console.error('Error in market monitoring:', error);
          }
      };

      // Initial check
      await checkMarket();
      
      // Schedule regular checks
      setInterval(checkMarket, CONFIG.MARKET.UPDATE_INTERVAL);
  }

  private async startCommunityEngagement() {
      const engageWithCommunity = async () => {
          try {
              const content = await ContentUtils.generateContent({
                  type: 'community',
                  sentiment: 'positive',
                  context: {
                      tokenMetrics: await this.checkTokenMetrics(),
                      communityGrowth: await socialService.getCommunityMetrics()
                  }
              });
              
              await socialService.broadcast(content);
          } catch (error) {
              console.error('Error in community engagement:', error);
          }
      };

      // Initial engagement
      await engageWithCommunity();
      
      // Schedule regular engagement
      setInterval(engageWithCommunity, CONFIG.SOCIAL.ENGAGEMENT_INTERVAL);
  }

  private async handleCommand(parsedCommand: any, message: Message) {
      switch (parsedCommand.command) {
          case 'price':
              await this.handlePriceCommand(message);
              break;
          case 'trade':
              await this.handleTradeCommand(message, parsedCommand);
              break;
          case 'stats':
              await this.handleStatsCommand(message);
              break;
          default:
              const response = await aiService.generateResponse({
                  content: message.content,
                  platform: 'discord',
                  author: message.author.tag,
                  channel: message.channel.id
              });
              await message.reply(response);
      }
  }

  private async handleTradingOpportunity(analysis: MarketAnalysis) {
      try {
          if (analysis.confidence > CONFIG.TRADING.CONFIDENCE_THRESHOLD) {
              const tradeResult = await tradingService.executeTrade({
                  inputMint: 'SOL',
                  outputMint: this.tokenAddress,
                  amount: CONFIG.TRADING.BASE_AMOUNT,
                  slippage: CONFIG.TRADING.DEFAULT_SLIPPAGE_BPS
              });

              // Announce successful trade
              const content = await ContentUtils.generateContent({
                  type: 'trade_execution',
                  variables: {
                      success: true,
                      txHash: tradeResult.signature
                  }
              });
              await socialService.broadcast(content);
          }
      } catch (error) {
          console.error('Error handling trading opportunity:', error);
      }
  }

  private async checkTokenMetrics() {
      try {
          return await this.solanaTools.get_balance(
              this.solanaKit,
              new PublicKey(this.tokenAddress)
          );
      } catch (error) {
          console.error('Error checking token metrics:', error);
          throw error;
      }
  }
}

// Create and start the agent
// src/index.ts - Part 4: Runtime Setup and Initialization

class MemeAgentRuntime extends AgentRuntime {
  async analyzeMarketSentiment() {
      try {
          return await this.generateText({
              text: "analyze current market sentiment",
              userId: "system",
              userName: "System"
          });
      } catch (error) {
          elizaLogger.error("Error analyzing market sentiment:", error);
          throw error;
      }
  }

  async generateMemeContent() {
      try {
          return await this.generateText({
              text: "generate crypto meme content",
              userId: "system",
              userName: "System"
          });
      } catch (error) {
          elizaLogger.error("Error generating meme content:", error);
          throw error;
      }
  }

  async generateText({ text, userId, userName }: { 
      text: string; 
      userId: string; 
      userName: string; 
  }): Promise<string> {
      return await this.provider.generateText(text, {
          userId,
          userName,
          context: {
              tokenMetrics: await this.getTokenMetrics(),
              marketSentiment: await this.getMarketSentiment()
          }
      });
  }

  private async getTokenMetrics() {
      // Implement token metrics retrieval
      return {};
  }

  private async getMarketSentiment() {
      // Implement market sentiment analysis
      return {};
  }
}

async function startAgent(character: Character, directClient: DirectClient): Promise<any[]> {
  try {
      character.id = character.id ?? stringToUuid(character.name);
      character.username = character.username ?? character.name;

      const token = await getTokenForProvider(character.modelProvider, character);
      const dataDir = path.join(__dirname, "../data");

      if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
      }

      const db = await initializeDatabase(dataDir);
      if (db && typeof db.init === 'function') {
          await db.init();
      } else {
          throw new Error('Database initialization failed');
      }

      const cache = await initializeDbCache(character, db);
      const runtime = createAgent(character, db, cache, token);

      await runtime.initialize();

      // Initialize social media clients
      const clients = await initializeClients(character, runtime);
      directClient.registerAgent(runtime);

      // Set up periodic tasks for the agent
      setupPeriodicTasks(runtime as MemeAgentRuntime);

      return clients;
  } catch (error) {
      elizaLogger.error(
          `Error starting agent for character ${character.name}:`,
          error
      );
      throw error;
  }
}

function setupPeriodicTasks(runtime: MemeAgentRuntime) {
  // Market Analysis Task
  setInterval(async () => {
      try {
          const sentiment = await runtime.analyzeMarketSentiment();
          await runtime.generateText({
              text: `Market Update: ${sentiment}`,
              userId: "system",
              userName: "System"
          });
      } catch (error) {
          elizaLogger.error("Error in market analysis task:", error);
      }
  }, CONFIG.MARKET.UPDATE_INTERVAL);

  // Meme Generation Task
  setInterval(async () => {
      try {
          const memeContent = await runtime.generateMemeContent();
          await socialService.broadcast(memeContent);
      } catch (error) {
          elizaLogger.error("Error in meme generation task:", error);
      }
  }, CONFIG.SOCIAL.MEME_INTERVAL);
}

async function initializeDatabase(dataDir: string): Promise<IDatabaseAdapter> {
  const dbConfig = CONFIG.DATABASE;
  
  if (dbConfig.type === 'postgres') {
      return new PostgresDatabaseAdapter(dbConfig.postgres);
  } else {
      const db = new Database(path.join(dataDir, "database.sqlite"));
      return new SqliteDatabaseAdapter(db);
  }
}

// Create and start the agent
const startMemeAgentInfluencer = async () => {
  try {
      const agent = new MemeAgentInfluencer();
      await agent.initialize();
      console.log('Meme Agent Influencer is running!');
  } catch (error) {
      console.error('Failed to start agent:', error);
      process.exit(1);
  }
};

// Start the agent
if (require.main === module) {
  startMemeAgentInfluencer().catch((error) => {
      console.error('Unhandled error:', error);
      process.exit(1);
  });
}

export {
  MemeAgentInfluencer,
  MemeAgentRuntime,
  startAgent,
  startMemeAgentInfluencer,
};
export const wait = (minTime: number = 1000, maxTime: number = 3000): Promise<void> => {
  const waitTime = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
  return new Promise((resolve) => setTimeout(resolve, waitTime));
};

interface MemeAgentRuntimeConfig {
  databaseAdapter: IDatabaseAdapter;
  token: string;
  modelProvider: ModelProviderName;
  evaluators: any[];
  character: Character;
  plugins: any[];
  providers: any[];
  actions: any[];
  services: any[];
  managers: any[];
  cacheManager: ICacheManager;
}

function createAgent(
  character: Character,
  db: IDatabaseAdapter,
  cache: ICacheManager,
  token: string
): MemeAgentRuntime {
  elizaLogger.success(
      elizaLogger.successesTitle,
      "Creating runtime for character",
      character.name
  );
  
  const config: MemeAgentRuntimeConfig = {
      databaseAdapter: db,
      token,
      modelProvider: character.modelProvider,
      evaluators: [],
      character,
      plugins: [
          bootstrapPlugin,
          nodePlugin,
          solanaPlugin,
      ],
      providers: [],
      actions: [],
      services: [],
      managers: [],
      cacheManager: cache,
  };

  return new MemeAgentRuntime(config);
}

async function getTokenForProvider(
  provider: ModelProviderName, 
  character: Character
): Promise<string> {
  switch (provider) {
      case 'groq':
          return CONFIG.AI.GROQ.API_KEY;
      case 'anthropic':
          return CONFIG.AI.ANTHROPIC.API_KEY;
      case 'openai':
          return CONFIG.AI.OPENAI.API_KEY;
      default:
          throw new Error(`Unsupported model provider: ${provider}`);
  }
}

async function initializeDbCache(
  character: Character, 
  db: IDatabaseAdapter
): Promise<ICacheManager> {
  if (!character.id) {
      throw new Error('Character ID is undefined');
  }

  const dbCacheAdapter: IDatabaseCacheAdapter = {
      ...db,
      getCache: async ({ agentId, key }: { agentId: string; key: string; }) => {
          try {
              // Implement cache retrieval logic
              return await db.get(`cache:${agentId}:${key}`);
          } catch (error) {
              elizaLogger.error('Cache retrieval error:', error);
              return undefined;
          }
      },
      setCache: async ({ 
          agentId, 
          key, 
          value 
      }: { 
          agentId: string; 
          key: string; 
          value: string; 
      }) => {
          try {
              await db.set(`cache:${agentId}:${key}`, value);
              return true;
          } catch (error) {
              elizaLogger.error('Cache set error:', error);
              return false;
          }
      },
      deleteCache: async ({ 
          agentId, 
          key 
      }: { 
          agentId: string; 
          key: string; 
      }) => {
          try {
              await db.delete(`cache:${agentId}:${key}`);
              return true;
          } catch (error) {
              elizaLogger.error('Cache deletion error:', error);
              return false;
          }
      }
  };

  return new CacheManager(new DbCacheAdapter(dbCacheAdapter, character.id));
}

async function initializeClients(
  character: Character, 
  runtime: IAgentRuntime
): Promise<any[]> {
  const clients = [];

  if (CONFIG.CLIENTS.DIRECT.enabled) {
      const directClient = await DirectClientInterface.start();
      directClient.registerAgent(runtime);
      clients.push(directClient);
  }

  if (CONFIG.CLIENTS.DISCORD.enabled) {
      const discordClient = await DiscordClientInterface.start({
          token: CONFIG.SOCIAL.DISCORD.TOKEN,
          guildId: CONFIG.SOCIAL.DISCORD.GUILD_ID
      });
      discordClient.registerAgent(runtime);
      clients.push(discordClient);
  }

  if (CONFIG.CLIENTS.TWITTER.enabled) {
      const twitterClient = await TwitterClientInterface.start({
          ...CONFIG.SOCIAL.TWITTER
      });
      twitterClient.registerAgent(runtime);
      clients.push(twitterClient);
  }

  return clients;
}

function initializeChatInterface(agentName: string) {
  const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
  });

  function chat() {
      rl.question("You: ", async (input) => {
          if (input.toLowerCase() === "exit") {
              rl.close();
              process.exit(0);
          }

          try {
              const response = await aiService.generateResponse({
                  content: input,
                  platform: 'cli',
                  author: 'user'
              });
              console.log(`${agentName}: ${response}`);
          } catch (error) {
              console.error('Error generating response:', error);
          }

          chat();
      });
  }

  elizaLogger.log(`${agentName} chat started. Type 'exit' to quit.`);
  chat();

  rl.on("SIGINT", () => {
      rl.close();
      process.exit(0);
  });
}

// Export everything needed for external use
export {
  type MemeAgentRuntimeConfig,
  type DatabaseConfig,
  type ClientConfig,
  type Settings,
  createAgent,
  getTokenForProvider,
  initializeDbCache,
  initializeClients,
  initializeChatInterface,
  wait
};

export default {
  MemeAgentInfluencer,
  MemeAgentRuntime,
  startAgent,
  startMemeAgentInfluencer,
};