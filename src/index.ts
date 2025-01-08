import { Connection, PublicKey } from '@solana/web3.js';
import { TwitterApi } from 'twitter-api-v2';
import { Client as DiscordClient, Message } from 'discord.js';
import Groq from "groq-sdk";
// import { CONFIG } from './config/settings';
import { config } from 'dotenv';
import { MemorySaver } from "@langchain/langgraph";
// Import services
import { SocialService } from './services/social';
import { ContentUtils } from './utils/content';
import { Parser } from './utils/parser';
import { TradingService } from './services/blockchain/trading';
// import { AIService } from './services/ai';
// import { TwitterService } from './services/social/twitter';

// Types
import { TokenInfo, MarketAnalysis, TradeResult, AgentCommand, CommandContext } from './services/blockchain/types';
import { SocialMetrics } from './services/social';

import {
    IAgentRuntime,
    elizaLogger} from "@ai16z/eliza";

// Import mainCharacter from local file
import { mainCharacter } from './mainCharacter';

// Extend IAgentRuntime to include llm
interface ExtendedAgentRuntime extends IAgentRuntime {
    llm: Groq;
}

// Add interfaces
interface MarketData {
  price: number;
  volume24h: number;
  marketCap: number;
  // Add other market data properties as needed
}

class MemeAgentInfluencer {
  private connection!: Connection;
  private groq!: Groq;
  private twitter!: TwitterApi;
  private discord!: DiscordClient;
  private aiService!: AIService;
  private socialService!: SocialService;
  private tradingService!: TradingService;
  private twitterService!: TwitterService;
  private tokenAddress: string;
  private isInitialized: boolean;
  private twitterClient!: TwitterApi;  // Add separate client for app-only auth
  private appOnlyClient!: TwitterApi;
  private runtime!: ExtendedAgentRuntime;

  constructor() {
    // Minimal initialization in constructor
    this.isInitialized = false;
    this.tokenAddress = '';
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing JENNA...');

      // 1. Initialize LLM 
      await this.initializeLLM();

      // 2. Initialize Twitter
      await this.verifyAndInitialize();

      // 3. Initialize Solana
      await this.initializeSolana();

      // 4. Initialize Services
      await this.initializeServices();

      // 5. Start automation
      await this.startAutomation();

      this.isInitialized = true;
      console.log('JENNA initialization complete');

    } catch (error) {
      console.error('Failed to initialize JENNA:', error);
      await this.cleanup();
      throw error;
    }
  }

  private async initializeLLM(): Promise<void> {
    try {
      const groqApiKey = process.env.GROQ_API_KEY;
      if (!groqApiKey) {
        throw new Error('GROQ API key not found');
      }

      this.groq = new Groq({ apiKey: groqApiKey });
      this.runtime = {
        llm: this.groq,
        // Add other runtime properties as needed
      } as ExtendedAgentRuntime;

      this.aiService = new AIService({
        groqApiKey,
        defaultModel: CONFIG.AI.GROQ.MODEL,
        maxTokens: CONFIG.AI.GROQ.MAX_TOKENS,
        temperature: CONFIG.AI.GROQ.DEFAULT_TEMPERATURE
      });

      console.log('LLM initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize LLM: ${(error as Error).message}`);
    }
  }

  private async initializeSolana(): Promise<void> {
    try {
      this.connection = new Connection(CONFIG.SOLANA.RPC_URL);
      const version = await this.connection.getVersion();
      console.log('Solana connection established:', version);

      const publicKey = new PublicKey(CONFIG.SOLANA.PUBLIC_KEY);
      const balance = await this.connection.getBalance(publicKey);
      console.log('Wallet balance:', balance / 1e9, 'SOL');

      // Initialize trading service
      this.tradingService = new TradingService(CONFIG.SOLANA.RPC_URL);
      
      console.log('Solana connection initialized');
    } catch (error) {
      throw new Error(`Failed to initialize Solana: ${(error as Error).message}`);
    }
  }

  async startAgent(): Promise<void> {
    try {
      // Initialize first
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Then start either chat or autonomous mode
      const mode = await this.chooseMode();
      
      const agentExecutor = await this.initializeAgent();
      
      if (mode === "chat") {
        await this.runChatMode(agentExecutor, {});
      } else if (mode === "auto") {
        await this.runAutonomousMode(agentExecutor, {});
      }
    } catch (error) {
      console.error('Failed to start agent:', error);
      await this.cleanup();
      throw error;
    }
  }

  public async verifyAndInitialize(): Promise<void> {
    try {
      const twitterConfig = {
        username: process.env.TWITTER_USERNAME!,
        password: process.env.TWITTER_PASSWORD!,
        email: process.env.TWITTER_EMAIL!,
        apiKey: process.env.TWITTER_API_KEY!,
        apiSecret: process.env.TWITTER_API_SECRET!,
        accessToken: process.env.TWITTER_ACCESS_TOKEN!,
        accessSecret: process.env.TWITTER_ACCESS_SECRET!,
        bearerToken: process.env.TWITTER_BEARER_TOKEN!,
        maxRetries: Number(process.env.TWITTER_MAX_RETRIES) || 3,
        retryDelay: Number(process.env.TWITTER_RETRY_DELAY) || 5000,
        contentRules: {
          maxEmojis: Number(process.env.TWITTER_MAX_EMOJIS) || 0,
          maxHashtags: Number(process.env.TWITTER_MAX_HASHTAGS) || 0,
          minInterval: Number(process.env.TWITTER_MIN_INTERVAL) || 300000
        }
      };
  
      // Validate all required credentials
      const requiredCredentials = [
        'username', 'password', 'email', 
        'apiKey', 'apiSecret', 
        'accessToken', 'accessSecret', 
        'bearerToken'
      ];
  
      (requiredCredentials as Array<keyof typeof twitterConfig>).forEach((key) => {
        if (!twitterConfig[key]) {
          throw new Error(`Missing required Twitter credential: ${key}`);
        }
      });
  
      // Initialize Twitter clients with credentials
      this.twitter = new TwitterApi({
        appKey: twitterConfig.apiKey,
        appSecret: twitterConfig.apiSecret,
        accessToken: twitterConfig.accessToken,
        accessSecret: twitterConfig.accessSecret
      });
  
      // Initialize app-only client for streams
      this.appOnlyClient = new TwitterApi(twitterConfig.bearerToken);
      this.twitterClient = this.twitter;
  
      // Verify credentials
      await this.verifyTwitterCredentials();
      elizaLogger.success('Twitter authentication successful');
  
    } catch (error) {
      elizaLogger.error('Twitter authentication error:', error);
      throw new Error('Failed to initialize Twitter: ' + (error as Error).message);
    }
  }
  private async setupTwitterStream(): Promise<void> {
    try {
      if (!this.appOnlyClient) {
        throw new Error('App-only client not initialized');
      }

      // Set up stream using app-only client
      const stream = await this.appOnlyClient.v2.searchStream({
        'tweet.fields': ['referenced_tweets', 'author_id'],
        expansions: ['referenced_tweets.id']
      });

      stream.autoReconnect = true;

      stream.on('data', async (tweet) => {
        try {
          // Use regular client for replies
          const sentiment = await this.aiService.analyzeSentiment(tweet.data.text);
          if (sentiment > 0.5) {
            const response = await this.aiService.generateResponse({
              content: tweet.data.text,
              platform: 'twitter',
              author: tweet.data.author_id || 'unknown',
              messageId: ''
            });
            // Use user context client for posting replies
            await this.twitter.v2.reply(response, tweet.data.id);
          }
        } catch (error) {
          elizaLogger.error('Error handling tweet:', error);
        }
      });

      elizaLogger.success('Twitter stream setup completed');
    } catch (error) {
      elizaLogger.error('Error setting up Twitter stream:', error);
      throw error;
    }
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.appOnlyClient) {
        // Use appOnlyClient for cleaning up stream rules
        await this.appOnlyClient.v2.updateStreamRules({ delete: { ids: ['*'] } });
      }
      if (this.discord) {
        this.discord.destroy();
      }
      this.isInitialized = false;
      console.log('Cleanup completed successfully');
    } catch (error) {
      console.error('Error during cleanup:', error);
      throw error;
    }
  }

  private async initializeServices(): Promise<void> {
    try {
      await this.socialService.initialize();
      elizaLogger.success('Social service initialized');

      await this.setupMessageHandling();
      elizaLogger.success('Message handling initialized');

      await this.setupTwitterRules();
      elizaLogger.success('Twitter rules initialized');

      await this.setupTwitterStream();
      elizaLogger.success('Twitter stream initialized');
    } catch (error) {
      elizaLogger.error('Service initialization failed:', error);
      throw error;
    }
  }

  private async verifyTwitterCredentials(): Promise<void> {
    try {
      const me = await this.twitter.v2.me();
      elizaLogger.success(`Twitter credentials verified for @${me.data.username}`);
    } catch (error) {
      elizaLogger.error('Twitter credentials verification failed:', error);
      throw new Error('Failed to verify Twitter credentials');
    }
  }

  async postTweet(content: string, options: { mediaUrls?: string[] } = {}): Promise<void> {
    try {
      elizaLogger.info('Preparing to post tweet...');
      
      let mediaIds: string[] = [];
      if (options.mediaUrls?.length) {
        mediaIds = await Promise.all(
          options.mediaUrls.map(url => this.twitter.v1.uploadMedia(url))
        );
      }

      const tweet = await this.twitter.v2.tweet({
        text: content,
        ...(mediaIds.length && { media: { media_ids: mediaIds.slice(0, 4) as [string] | [string, string] | [string, string, string] | [string, string, string, string] } })
      });

      elizaLogger.success('Tweet posted successfully:', tweet.data.id);
    } catch (error) {
      elizaLogger.error('Failed to post tweet:', error);
      throw error;
    }
  }

  // Add postTweetWithRetry method
  async postTweetWithRetry(content: string, retries = 3): Promise<void> {
    const baseWaitTime = 5000; // Start with 5 seconds
    let lastError: any;
    
    for (let i = 0; i < retries; i++) {
      try {
        await this.twitter.v2.tweet({ text: content });
        elizaLogger.success('Tweet posted successfully');
        return;
      } catch (error: any) {
        lastError = error;
        elizaLogger.error(`Failed to post tweet (attempt ${i + 1}):`, error);
        await new Promise(resolve => setTimeout(resolve, baseWaitTime * (i + 1)));
      }
    }
    
    elizaLogger.error('Failed to post tweet after multiple attempts:', lastError);
    throw lastError;
  }

  private async setupTwitterRules(): Promise<void> {
    try {
      // Ensure we have a valid bearer token
      if (!process.env.TWITTER_BEARER_TOKEN) {
        throw new Error('Twitter Bearer Token is required for stream rules');
      }

      // Use app client for stream rules (same as user client in direct auth)
      if (!this.appOnlyClient) {
        this.appOnlyClient = this.twitter;
      }

      const rules = await this.appOnlyClient.v2.streamRules();
      
      // Delete existing rules if any
      if (rules.data?.length) {
        await this.appOnlyClient.v2.updateStreamRules({
          delete: { ids: rules.data.map(rule => rule.id) }
        });
      }

      // Add new rules using app-only client
      await this.appOnlyClient.v2.updateStreamRules({
        add: [
         // { value: `@${CONFIG.SOCIAL.TWITTER.USERNAME}`, tag: 'mentions' },
          { value: CONFIG.SOLANA.TOKEN_SETTINGS.SYMBOL, tag: 'token_mentions' }
        ]
      });

      elizaLogger.success('Twitter rules setup completed');
    } catch (error: any) {
      // More specific error handling
      if (error.code === 403) {
        elizaLogger.error('Authentication error: Make sure you have the correct Bearer Token with appropriate permissions');
      } else {
        elizaLogger.error('Error setting up Twitter rules:', error);
      }
      throw error;
    }
  }

  private scheduleTwitterContent(): void {
    setInterval(async () => {
      try {
        const price = await this.getCurrentPrice();
        const content = await this.aiService.generateResponse({
          content: `Current ${CONFIG.SOLANA.TOKEN_SETTINGS.SYMBOL} price: ${price} SOL`,
          platform: 'twitter',
          author: '',
          messageId: ''
        });
        
        await this.postTweet(content);
      } catch (error) {
        elizaLogger.error('Error in scheduled Twitter content:', error);
      }
    }, CONFIG.AUTOMATION.CONTENT_GENERATION_INTERVAL);
  }

  private async createToken(_tokenSettings: {
    name: string;
    symbol: string;
    decimals: number;
    metadata: string;
  }): Promise<{ mint: string }> {
    // Implement the logic to create a token and return its mint address
    const mintAddress = '9gxa9dZbWzju9wpDxsnTKusrN7SRGaxaLHq2JVXUa78H'; // Replace with actual mint address
    return { mint: mintAddress };
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

  // Fix the startAutomation method
  private async startAutomation(): Promise<void> {
    await Promise.all([
      this.startContentGeneration(),
      this.startMarketMonitoring(),
      this.startCommunityEngagement()
    ]);

    // Add type check for mainCharacter.settings
    if (!mainCharacter.settings?.chains) {
      elizaLogger.warn('No tweet chains configured, using default interval');
      const defaultInterval = 1800000; // 30 minutes
      this.scheduleTweets(defaultInterval);
      return;
    }

    const tweetChain = Array.isArray(mainCharacter.settings.chains) 
      ? mainCharacter.settings.chains.find(chain => chain.type === 'tweet' && chain.enabled) 
      : mainCharacter.settings.chains.twitter?.[0];
      
    const tweetInterval = tweetChain?.interval ?? 1800000;
    this.scheduleTweets(tweetInterval);
  }

  // Add helper method for tweet scheduling
  private scheduleTweets(interval: number): void {
    setInterval(async () => {
      try {
        const marketData = await this.tradingService.getMarketData(this.tokenAddress);
        await this.postAITweet({
          topic: CONFIG.SOLANA.TOKEN_SETTINGS.SYMBOL,
          price: marketData.price.toString(), // Convert to string
          volume: marketData.volume24h.toString() // Convert to string
        });
      } catch (error) {
        elizaLogger.error('Error in automated tweet generation:', error);
      }
    }, interval);
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

        // Post to Twitter instead of using socialService
        await this.postTweet(content);
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
    const aiAnalysis = await this.aiService.analyzeMarket(this.tokenAddress);
    
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
          messageId: ''
        });
    }
  }

  async replyToTweet(tweetId: string, content: string): Promise<void> {
    try {
      await this.twitter.v2.reply(content, tweetId);
      elizaLogger.success('Reply posted successfully');
    } catch (error) {
      elizaLogger.error('Failed to reply to tweet:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    try {
      if (this.appOnlyClient) {
        // Use appOnlyClient for cleaning up stream rules
        await this.appOnlyClient.v2.updateStreamRules({ delete: { ids: ['*'] } });
      }
      this.discord.destroy();
      this.isInitialized = false;
      elizaLogger.success('Agent shutdown complete');
    } catch (error) {
      elizaLogger.error('Error during shutdown:', error);
      throw error;
    }
  }

  private async initializeAgent(): Promise<void> {
    // Initialize LLM
    const groqApiKey = process.env.GROQ_API_KEY;
    const llm = new Groq({ apiKey: groqApiKey });

    // Load Bearer Token
    const twitterBearerToken = process.env.TWITTER_BEARER_TOKEN;
    const twitterAccessToken = process.env.TWITTER_ACCESS_TOKEN;
    const twitterAccessTokenSecret = process.env.TWITTER_ACCESS_SECRET;

    if (!twitterBearerToken || !twitterAccessToken || !twitterAccessTokenSecret) {
      throw new Error("Twitter Bearer Token, access token, or access token secret is missing. Please check your .env file.");
    }

    // Load OAuth 2.0 Client ID and Client Secret
    const oauthClientId = process.env.OAUTH_CLIENT_ID;
    const oauthClientSecret = process.env.OAUTH_CLIENT_SECRET;

    if (!oauthClientId || !oauthClientSecret) {
      throw new Error("OAuth Client ID or Client Secret is missing. Please check your .env file.");
    }

    // Store buffered conversation history in memory
    const memory = new MemorySaver();

    // Create and configure the agent with default system prompt
    const defaultSystemPrompt = "You are an AI agent specialized in cryptocurrency and blockchain interactions. Help users understand and interact with blockchain technology.";
    
    const agent = await createReActAgent(
      llm,
      [], // Add tools as needed
      memory,
      defaultSystemPrompt // Use default prompt instead of mainCharacter.settings.systemPrompt
    );

    return agent;
  }

  private async runAutonomousMode(agentExecutor: any, config: any, interval = 10): Promise<void> {
    console.log("Starting autonomous mode...");
    while (true) {
      try {
        // Provide instructions autonomously
        const thought = "Be creative and do something interesting on the blockchain. Choose an action or set of actions and execute it that highlights your abilities.";

        // Run agent in autonomous mode
        for await (const chunk of agentExecutor.stream({ messages: [{ content: thought }] }, config)) {
          if (chunk.agent) {
            console.log(chunk.agent.messages[0].content);
          } else if (chunk.tools) {
            console.log(chunk.tools.messages[0].content);
          }
          console.log("-------------------");
        }

        // Wait before the next action
        await new Promise(resolve => setTimeout(resolve, interval * 1000));
      } catch (error) {
        console.log("Goodbye Agent!");
        process.exit(0);
      }
    }
  }

  private async runChatMode(agentExecutor: any, config: any): Promise<void> {
    console.log("Starting chat mode... Type 'exit' to end.");
    while (true) {
      try {
        const userInput = await new Promise<string>(resolve => {
          process.stdout.write("\nPrompt: ");
          process.stdin.once('data', data => resolve(data.toString().trim()));
        });

        if (userInput.toLowerCase() === "exit") {
          break;
        }

        // Run agent with the user's input in chat mode
        for await (const chunk of agentExecutor.stream({ messages: [{ content: userInput }] }, config)) {
          if (chunk.agent) {
            console.log(chunk.agent.messages[0].content);
          } else if (chunk.tools) {
            console.log(chunk.tools.messages[0].content);
          }
          console.log("-------------------");
        }
      } catch (error) {
        console.log("Goodbye Agent!");
        process.exit(0);
      }
    }
  }

  private async chooseMode(): Promise<string> {
    while (true) {
      console.log("\nAvailable modes:");
      console.log("1. chat    - Interactive chat mode");
      console.log("2. auto    - Autonomous action mode");

      const choice = await new Promise<string>(resolve => {
        process.stdout.write("\nChoose a mode (enter number or name): ");
        process.stdin.once('data', data => resolve(data.toString().trim().toLowerCase()));
      });

      if (choice === "1" || choice === "chat") {
        return "chat";
      } else if (choice === "2" || choice === "auto") {
        return "auto";
      }
      console.log("Invalid choice. Please try again.");
    }
  }

  async main(): Promise<void> {
    try {
      console.log("Starting Agent...");
      const agentExecutor = await this.initializeAgent();

      const mode = await this.chooseMode();
      if (mode === "chat") {
        await this.runChatMode(agentExecutor, {});
      } else if (mode === "auto") {
        await this.runAutonomousMode(agentExecutor, {});
      }
    } catch (error) {
      console.error("Fatal error during initialization:", error);
      process.exit(1);
    }
  }

  // Add new method for AI tweet generation
  private async generateTweetContent(context: any = {}): Promise<string> {
    try {
        const prompt = `Generate an engaging tweet about ${context.topic || 'cryptocurrency'} 
                      that is informative and entertaining. Include relevant market metrics 
                      if available. Max length: 280 characters.`;

        const response = await this.runtime.llm.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'mixtral-8x7b-32768',
            max_tokens: 100,
            temperature: 0.7
        });

        const message = response.choices[0]?.message?.content;
        if (!message) {
            throw new Error('Failed to generate tweet content');
        }
        return message.trim();
    } catch (error) {
        elizaLogger.error('Error generating tweet content:', error);
        throw error;
    }
  }

  // Add new method for AI-powered Twitter posting
  async postAITweet(context: any = {}): Promise<void> {
    try {
        elizaLogger.info('Generating AI tweet...');
        
        // Generate tweet content
        const content = await this.generateTweetContent(context);
        
        // Post tweet with retry logic
        await this.postTweetWithRetry(content);
        
        elizaLogger.success('AI tweet posted successfully');
    } catch (error) {
        elizaLogger.error('Failed to post AI tweet:', error);
        throw error;
    }
  }

  async startTwitterBot(): Promise<void> {
    try {
      elizaLogger.info('Starting Twitter bot...');
      
      if (!this.twitterService) {
        this.twitterService = new TwitterService({
          apiKey: process.env.TWITTER_API_KEY!,
          apiSecret: process.env.TWITTER_API_SECRET!,
          accessToken: process.env.TWITTER_ACCESS_TOKEN!,
          accessSecret: process.env.TWITTER_ACCESS_SECRET!,
          bearerToken: process.env.TWITTER_BEARER_TOKEN!,
          oauthClientId: process.env.OAUTH_CLIENT_ID!,
          oauthClientSecret: process.env.OAUTH_CLIENT_SECRET!,
          mockMode: process.env.TWITTER_MOCK_MODE === 'true',
          maxRetries: Number(process.env.TWITTER_MAX_RETRIES) || 3,
          retryDelay: Number(process.env.TWITTER_RETRY_DELAY) || 5000,
          contentRules: {
            maxEmojis: Number(process.env.TWITTER_MAX_EMOJIS) || 0,
            maxHashtags: Number(process.env.TWITTER_MAX_HASHTAGS) || 0,
            minInterval: Number(process.env.TWITTER_MIN_INTERVAL) || 300000
          }
        }, this.aiService);
        
        await this.twitterService.initialize();
      }
      
      // Use TwitterService's methods instead of direct implementation
      //await this.twitterService.startStream();
      this.scheduleTwitterContent();
      
      elizaLogger.success('Twitter bot started successfully');
    } catch (error) {
      elizaLogger.error('Failed to start Twitter bot:', error);
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

import { config as loadConfig } from 'dotenv';
import { TwitterService } from './services/social/twitter';
import { AIService } from './services/ai';
import { CONFIG } from './config/settings';

async function main() {
  try {
    console.log('Meme Agent Starting...');
    console.log('Loading configuration...');
    loadConfig();

    // Log configuration (redact sensitive info)
    console.log('Configuration loaded:', {
      network: CONFIG.SOLANA.NETWORK,
      rpcUrl: CONFIG.SOLANA.RPC_URL,
      pubkey: CONFIG.SOLANA.PUBLIC_KEY
    });

    // Log environment variables to verify they are loaded correctly
    console.log('Twitter API Key:', process.env.TWITTER_API_KEY);
    console.log('Twitter API Secret:', process.env.TWITTER_API_SECRET);
    console.log('Twitter Access Token:', process.env.TWITTER_ACCESS_TOKEN);
    console.log('Twitter Access Secret:', process.env.TWITTER_ACCESS_SECRET);
    console.log('Twitter Bearer Token:', process.env.TWITTER_BEARER_TOKEN);
    console.log('OAuth Client ID:', process.env.OAUTH_CLIENT_ID);
    console.log('OAuth Client Secret:', process.env.OAUTH_CLIENT_SECRET);

    const aiService = new AIService({
      groqApiKey: process.env.GROQ_API_KEY!,
      defaultModel: CONFIG.AI.GROQ.MODEL,
      maxTokens: CONFIG.AI.GROQ.MAX_TOKENS,
      temperature: CONFIG.AI.GROQ.DEFAULT_TEMPERATURE
    });
    const twitterService = new TwitterService({
      apiKey: process.env.TWITTER_API_KEY!,
      apiSecret: process.env.TWITTER_API_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN!,
      accessSecret: process.env.TWITTER_ACCESS_SECRET!,
      bearerToken: process.env.TWITTER_BEARER_TOKEN!,
      oauthClientId: process.env.OAUTH_CLIENT_ID!,
      oauthClientSecret: process.env.OAUTH_CLIENT_SECRET!,
      mockMode: process.env.TWITTER_MOCK_MODE === 'true',
      maxRetries: Number(process.env.TWITTER_MAX_RETRIES) || 3,
      retryDelay: Number(process.env.TWITTER_RETRY_DELAY) || 5000,
      contentRules: {
        maxEmojis: Number(process.env.TWITTER_MAX_EMOJIS) || 0,
        maxHashtags: Number(process.env.TWITTER_MAX_HASHTAGS) || 0,
        minInterval: Number(process.env.TWITTER_MIN_INTERVAL) || 300000
      },
      streamingEnabled: process.env.TWITTER_STREAMING_ENABLED === 'true'
    }, aiService);

    await twitterService.initialize();

    // Example call to publishMarketUpdate
    await twitterService.publishMarketUpdate({
      price: 123.45,
      volume24h: 67890,
      priceChange24h: 1.23,
      marketCap: 987654321,
      topHolders: ['Holder1', 'Holder2']
    });

    console.log('MemeAgent fully initialized and running!');

    console.log("2. auto    - Autonomous action mode");

    const choice = await new Promise<string>(resolve => {
      process.stdout.write("\nChoose a mode (enter number or name): ");
      process.stdin.once('data', data => resolve(data.toString().trim().toLowerCase()));
    });

    if (choice === "1" || choice === "chat") {
      return "chat";
    } else if (choice === "2" || choice === "auto") {
      return "auto";
    }
    console.log("Invalid choice. Please try again.");
  } catch (error) {
    console.error('Error during initialization:', error);
    throw error;
  }
}

main();

const agent = new MemeAgentInfluencer();
agent.main().catch(error => {
  console.error("Fatal error:", error);
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

function createReActAgent(llm: Groq, tools: any, memory: any, systemPrompt: string): Promise<any> {
  try {
    // Initialize the agent with provided components
    const agent = {
      llm,
      tools,
      memory,
      systemPrompt,
      
      async stream(input: { messages: Array<{ content: string }> }) {
        try {
          // Process the input using LLM
          const response = await llm.chat.completions.create({
            messages: [
              { role: 'system', content: systemPrompt },
              ...input.messages.map(msg => ({ role: 'user' as const, content: msg.content, name: 'user' }))
            ],
            model: 'mixtral-8x7b-32768',
            stream: true
          });

          // Store conversation in memory
          await memory.save({
            messages: input.messages,
            response: response
          });

          // Return response stream
          return {
            async *[Symbol.asyncIterator]() {
              for await (const chunk of response) {
                yield {
                  agent: {
                    messages: [{ content: chunk.choices[0]?.delta?.content || '' }]
                  }
                };
              }
            }
          };
        } catch (error) {
          console.error('Error in agent stream:', error);
          throw error;
        }
      }
    };

    return Promise.resolve(agent);
  } catch (error) {
    console.error('Error creating ReAct agent:', error);
    throw error;
  }
}