import { SolanaAgentKit, createSolanaTools } from 'solana-agent-kit';
import { TwitterApi } from 'twitter-api-v2';
import { Client as DiscordClient, Message, TextChannel } from 'discord.js';
import { PublicKey } from '@solana/web3.js';
import Groq from "groq-sdk";
import { CONFIG } from './config/settings';
import { aiService } from './services/ai'; // Use the correct instance
import { socialService } from './services/social';
import { tradingService } from './services/trading';
import { ContentUtils } from './utils/content';
import { Parser } from './utils/parser';
import { PostgresDatabaseAdapter } from "@ai16z/adapter-postgres";
import { SqliteDatabaseAdapter } from "@ai16z/adapter-sqlite";
import { DirectClientInterface } from "@ai16z/client-direct";
import { DiscordClientInterface } from "@ai16z/client-discord";
import { TwitterClientInterface } from "@ai16z/client-twitter";
import {
  DbCacheAdapter,
  defaultCharacter,
  FsCacheAdapter,
  ICacheManager,
  IDatabaseCacheAdapter,
  stringToUuid,
  AgentRuntime,
  CacheManager,
  Character,
  IAgentRuntime,
  ModelProviderName,
  elizaLogger,
  settings,
  IDatabaseAdapter,
  validateCharacterConfig,
} from "@ai16z/eliza";
import { bootstrapPlugin } from "@ai16z/plugin-bootstrap";
import { solanaPlugin } from "@ai16z/plugin-solana";
import { nodePlugin } from "@ai16z/plugin-node";
import Database from "better-sqlite3";
import * as fs from "fs";
import * as readline from "readline";
import yargs from "yargs";
import * as path from "path";
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { character } from "./character";
import type { DirectClient } from "@ai16z/client-direct";

const __filename: string = typeof import.meta !== 'undefined' 
  ? fileURLToPath(import.meta.url)
  : '';
const __dirname: string = typeof import.meta !== 'undefined'
  ? dirname(fileURLToPath(import.meta.url))
  : '';

// Add these interfaces at the top of your file
interface DatabaseConfig {
  type: 'postgres' | 'sqlite';
  postgres?: {
    connectionString: string;
    // other postgres specific settings
  };
  sqlite?: {
    filename: string;
  };
}

interface ClientConfig {
  enabled: boolean;
  // other client specific settings
}

interface Settings {
  database: DatabaseConfig;
  clients: {
    direct: ClientConfig;
    discord: ClientConfig;
    twitter: ClientConfig;
  };
  // other settings
}

// Cast the imported settings to our interface
const typedSettings = settings as unknown as Settings;

// Utility function for random delays between actions
export const wait = (minTime: number = 1000, maxTime: number = 3000) => {
  const waitTime = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
  return new Promise((resolve) => setTimeout(resolve, waitTime));
};


interface TradeTransaction {
    tokenAddress?: string;
    amount: number;
    slippage?: number;
}

interface MarketAnalysis {
    shouldTrade: boolean;
    confidence: number;
}

class MemeAgentInfluencer {
    private solanaKit: SolanaAgentKit;
    private solanaTools: any;
    private groq: Groq;
    private twitter: TwitterApi;
    private discord: DiscordClient;
    private tokenAddress: string;
    private isInitialized: boolean = false;

    constructor() {
        // Initialize Solana Kit with tools
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

            // Launch token using Solana Kit
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
            {
            }
        );
    }

    private async initializeServices() {
        // Initialize social services
        await socialService.initialize();
        console.log('Social service initialized');

        // Initialize trading service
        await tradingService.startTradingBot();
        console.log('Trading service initialized');

        // Setup message handling
        await this.setupMessageHandling();
        console.log('Message handling initialized');
    }

    private async startAutomation() {
        // Start content generation
        this.startContentGeneration();
        console.log('Content generation started');

        // Start market monitoring
        this.startMarketMonitoring();
        console.log('Market monitoring started');

        // Start community engagement
        this.startCommunityEngagement();
        console.log('Community engagement started');
    }

    private async setupMessageHandling() {
        // Discord message handling
        this.discord.on('messageCreate', async (message: Message) => {
            if (message.author.bot) return;

            const parsedCommand = Parser.parseCommand(message.content);
            if (!parsedCommand) return;

            try {
                await this.handleCommand(parsedCommand, message);
            } catch (error) {
                console.error('Error handling command:', error);
                await message.reply('Sorry, there was an error processing your command.');
            }
        });

        // Twitter stream handling
        await this.setupTwitterStream();
    }

    private async setupTwitterStream() {
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
                const response = await aiService.generateResponse({ content: tweet.text, platform: 'twitter' });
                await this.twitter.v2.reply(response, tweet.id);
            } catch (error) {
                console.error('Error handling tweet:', error);
            }
        });
    }

    private async startContentGeneration() {
        setInterval(async () => {
            try {
                const content = await ContentUtils.generateContent({
                    type: 'meme',
                    platform: 'twitter'
                });
                await socialService.broadcast(content);
            } catch (error) {
                console.error('Error in content generation:', error);
            }
        }, CONFIG.SOCIAL.TWITTER.POSTING_INTERVAL);
    }

    private async startMarketMonitoring() {
        setInterval(async () => {
            try {
                const metrics = await tradingService.getMarketData(this.tokenAddress);
                const analysis: MarketAnalysis = await aiService.analyzeMarket(metrics);

                if (analysis.shouldTrade) {
                    await this.handleTradingOpportunity(analysis);
                }
            } catch (error) {
                console.error('Error in market monitoring:', error);
            }
        }, CONFIG.MARKET.UPDATE_INTERVAL);
    }

    private async startCommunityEngagement() {
        setInterval(async () => {
            try {
                const content = await ContentUtils.generateContent({
                    type: 'community',
                    sentiment: 'positive'
                });
                await socialService.broadcast(content);
            } catch (error) {
                console.error('Error in community engagement:', error);
            }
        }, CONFIG.SOCIAL.TWITTER.POSTING_INTERVAL * 2);
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
                const response = await aiService.generateResponse({ content: message.content, platform: 'discord' });
                await message.reply(response);
        }
    }

    private async handlePriceCommand(message: Message) {
        try {
            const price = await tradingService.getTokenPrice(this.tokenAddress);
            const content = await ContentUtils.generateContent({
                type: 'market_update',
                variables: {
                    price: price.toString(),
                    currency: 'USD'
                }
            });
            await message.reply(content);
        } catch (error) {
            console.error('Error handling price command:', error);
            await message.reply('Error fetching price information.');
        }
    }

    private async handleTradeCommand(message: Message, parsedCommand: any) {
        const transaction = Parser.parseTransactionRequest(message.content);
        if (!transaction) {
            await message.reply('Invalid trade command format.');
            return;
        }

        try {
            const result = await tradingService.executeTrade({
                inputMint: transaction.tokenAddress || 'SOL',
                outputMint: this.tokenAddress,
                amount: transaction.amount,
                slippage: transaction.slippage || CONFIG.SOLANA.TRADING.DEFAULT_SLIPPAGE_BPS
            });
            await message.reply(`Trade executed! Transaction: ${result}`);
        } catch (error) {
            console.error('Trade failed:', error);
            await message.reply('Sorry, the trade failed. Please try again.');
        }
    }

    private async handleStatsCommand(message: Message) {
        try {
            const metrics = await this.checkTokenMetrics();
            const content = await ContentUtils.generateContent({
                type: 'market_update',
                variables: metrics
            });
            await message.reply(content);
        } catch (error) {
            console.error('Error handling stats command:', error);
            await message.reply('Error fetching token statistics.');
        }
    }

    private async handleTradingOpportunity(analysis: any) {
        if (analysis.confidence > 0.7) {
            await tradingService.executeTrade({
                inputMint: 'SOL',
                outputMint: this.tokenAddress,
                amount: CONFIG.SOLANA.TRADING.MIN_SOL_BALANCE * 2,
                slippage: CONFIG.SOLANA.TRADING.DEFAULT_SLIPPAGE_BPS
            });
        }
    }

    private async checkTokenMetrics() {
        return await this.solanaTools.get_balance(
            this.solanaKit,
            new PublicKey(this.tokenAddress)
        );
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

if (require.main === module) {
    startMemeAgentInfluencer();
}
// Extended agent runtime for MemeAgentX specific features
class MemeAgentRuntime extends AgentRuntime {
    async analyzeMarketSentiment() {
      // Implement market analysis logic
      return await this.generateText({
        text: "analyze current market sentiment",
        userId: "system",
        userName: "System"
      });
    }
  
    async generateMemeContent() {
      // Implement meme generation logic
      return await this.generateText({
        text: "generate crypto meme content",
        userId: "system",
        userName: "System"
      });
    }
  
    async generateText({ text, userId, userName }: { text: string; userId: string; userName: string; }) {
      // Implement text generation logic
      return `Generated text for ${userName}: ${text}`;
    }
  }
  
  async function startAgent(character: Character, directClient: DirectClient) {
    try {
      character.id ??= stringToUuid(character.name);
      character.username ??= character.name;
  
      const token = await getTokenForProvider(character.modelProvider, character);
      const dataDir = path.join(__dirname, "../data");
  
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
  
      const db = await initializeDatabase(dataDir);
      if (db && typeof db.init === 'function') {
        await db.init();
      } else {
        throw new Error('Database initialization failed: db is undefined or init is not a function');
      }
  
      const cache = await initializeDbCache(character, db);
      const runtime = createAgent(character, db, cache, token);
  
      await runtime.initialize();
  
      // Initialize social media clients
      const clients = await initializeClients(character, runtime);
      (directClient as DirectClient).registerAgent(runtime);
  
      // Set up periodic tasks for the agent
      setupPeriodicTasks(runtime as MemeAgentRuntime);
  
      return clients;
    } catch (error) {
      elizaLogger.error(
        `Error starting agent for character ${character.name}:`,
        error
      );
      console.error(error);
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
    }, 30 * 60 * 1000); // Every 30 minutes
  
    // Meme Generation Task
    setInterval(async () => {
      try {
        const memeContent = await runtime.generateMemeContent();
        // Post to social media
      } catch (error) {
        elizaLogger.error("Error in meme generation task:", error);
      }
    }, 60 * 60 * 1000); // Every hour
  }
  
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
  
  async function getTokenForProvider(provider: ModelProviderName, character: Character): Promise<string> {
    // Implement token retrieval logic
    return "your-token";
  }
  
  async function initializeDatabase(dataDir: string): Promise<IDatabaseAdapter> {
    // Implement database initialization logic
    if (typedSettings.database.type === 'postgres') {
      return new PostgresDatabaseAdapter(typedSettings.database.postgres);
    } else {
      return new SqliteDatabaseAdapter(new Database(path.join(dataDir, "database.sqlite")));
    }
  }
  
  async function initializeDbCache(character: Character, db: IDatabaseAdapter): Promise<ICacheManager> {
    // Ensure the database adapter implements the required methods
    const dbCacheAdapter: IDatabaseCacheAdapter = {
      ...db,
      getCache: async ({ agentId, key }: { agentId: string; key: string; }) => {
        // Implement getCache logic
        return undefined;
      },
      setCache: async ({ agentId, key, value }: { agentId: `${string}-${string}-${string}-${string}-${string}`; key: string; value: string; }) => {
        // Implement setCache logic
        return true;
      },
      deleteCache: async ({ agentId, key }: { agentId: `${string}-${string}-${string}-${string}-${string}`; key: string; }) => {
        // Implement deleteCache logic
        return true;
      }
    };
  
    if (!character.id) {
        throw new Error('Character ID is undefined');
    }
    return new CacheManager(new DbCacheAdapter(dbCacheAdapter, character.id));
  }
  
  async function initializeClients(character: Character, runtime: IAgentRuntime): Promise<any[]> {
    const clients = [];
  
    if (typedSettings.clients.direct.enabled) {
      const directClient = await DirectClientInterface.start();
      (directClient as DirectClient).registerAgent(runtime as AgentRuntime);
      clients.push(directClient);
    }
  
    if (typedSettings.clients.discord.enabled) {
      const discordClient = await DiscordClientInterface.start();
      (discordClient as any).registerAgent(runtime as AgentRuntime);
      clients.push(discordClient);
    }
  
    if (typedSettings.clients.twitter.enabled) {
      const twitterClient = await TwitterClientInterface.start();
      (twitterClient as any).registerAgent(runtime as AgentRuntime);
      clients.push(twitterClient);
    }
  
    return clients;
  }
  
  async function parseArguments(): Promise<any> {
    // Implement argument parsing logic
    return yargs(process.argv.slice(2)).argv;
  }
  
  async function loadCharacters(filePath: string): Promise<Character[]> {
    // Implement character loading logic
    return [character];
  }
  
  async function handleUserInput(input: string, agentName: string): Promise<void> {
    // Implement user input handling logic
    console.log(`${agentName}: ${input}`);
  }
  
  // ... keep the rest of the utility functions unchanged ...
  
  const startAgents = async () => {
    const directClient = await DirectClientInterface.start();
    const args = await parseArguments();
  
    let characters = [character]; // Default to our MemeAgentX character
    
    if (args.characters) {
      characters = await loadCharacters(args.characters);
    }
  
    try {
      for (const character of characters) {
        await startAgent(character, directClient as DirectClient);
      }
    } catch (error) {
      elizaLogger.error("Error starting agents:", error);
    }
  
    // Start chat interface
    initializeChatInterface(characters[0].name);
  };
  
  function initializeChatInterface(agentName: string) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  
    function chat() {
      rl.question("You: ", async (input) => {
        await handleUserInput(input, agentName);
        if (input.toLowerCase() !== "exit") {
          chat();
        }
      });    }  
    elizaLogger.log("MemeAgentX chat started. Type 'exit' to quit.");
    chat();
  
    rl.on("SIGINT", () => {
      rl.close();
      process.exit(0);
    });
  }
  
  // Start the agent
  startAgents().catch((error) => {
    elizaLogger.error("Unhandled error in startAgents:", error);
    process.exit(1);
  });

export default MemeAgentInfluencer;