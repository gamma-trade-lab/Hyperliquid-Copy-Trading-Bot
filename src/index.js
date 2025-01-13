import { TwitterApi } from 'twitter-api-v2';
import Groq from "groq-sdk";
import { MemorySaver } from "@langchain/langgraph";
import { ContentUtils } from './utils/content';
import { Parser } from './utils/parser';
import { TradingService } from './services/blockchain/trading';
import { elizaLogger } from "@ai16z/eliza";
// Import mainCharacter from local file
import { mainCharacter } from './mainCharacter';
loadConfig();
async function fetchTokenAddresses() {
    try {
        const response = await axios.get('https://tokens.jup.ag/tokens?tags=verified');
        return response.data.map((token) => token.address);
    }
    catch (error) {
        elizaLogger.error('Failed to fetch token addresses:', error);
        throw error;
    }
}
async function initializeServices() {
    try {
        // Fetch token addresses dynamically
        const tokenAddresses = await fetchTokenAddresses();
        // Initialize data processor
        const dataProcessor = new MarketDataProcessor(process.env.HELIUS_API_KEY, 'https://tokens.jup.ag/tokens?tags=verified');
        // Initialize AI service
        const aiService = new AIService({
            groqApiKey: process.env.GROQ_API_KEY,
            defaultModel: CONFIG.AI.GROQ.MODEL,
            maxTokens: CONFIG.AI.GROQ.MAX_TOKENS,
            temperature: CONFIG.AI.GROQ.DEFAULT_TEMPERATURE
        });
        // Initialize Twitter service
        const twitterService = new TwitterService({
            apiKey: process.env.TWITTER_API_KEY,
            apiSecret: process.env.TWITTER_API_SECRET,
            accessToken: process.env.TWITTER_ACCESS_TOKEN,
            accessSecret: process.env.TWITTER_ACCESS_SECRET,
            bearerToken: process.env.TWITTER_BEARER_TOKEN,
            oauthClientId: process.env.OAUTH_CLIENT_ID,
            oauthClientSecret: process.env.OAUTH_CLIENT_SECRET,
            mockMode: process.env.TWITTER_MOCK_MODE === 'true',
            maxRetries: Number(process.env.TWITTER_MAX_RETRIES) || 3,
            retryDelay: Number(process.env.TWITTER_RETRY_DELAY) || 5000,
            contentRules: {
                maxEmojis: Number(process.env.TWITTER_MAX_EMOJIS) || 0,
                maxHashtags: Number(process.env.TWITTER_MAX_HASHTAGS) || 0,
                minInterval: Number(process.env.TWITTER_MIN_INTERVAL) || 300000
            },
            marketDataConfig: {
                heliusApiKey: process.env.HELIUS_API_KEY,
                updateInterval: 1800000,
                volatilityThreshold: 0.05
            },
            tokenAddresses: tokenAddresses, // Pass the fetched token addresses
            baseUrl: 'https://api.twitter.com'
        }, aiService, dataProcessor);
        // Initialize WalletProvider
        const walletProviderInstance = new WalletProvider(new Connection(CONFIG.SOLANA.RPC_URL), new PublicKey(CONFIG.SOLANA.PUBLIC_KEY));
        // Initialize TokenProvider
        // Create cache adapter that implements ICacheManager
        const cacheAdapter = {
            async get(key) {
                return cache.get(key);
            },
            async set(key, value, options) {
                cache.set(key, value, options?.ttl);
            },
            async delete(key) {
                cache.del(key);
            }
        };
        const cache = new NodeCache();
        const tokenProviderInstance = new TokenProvider(tokenAddresses[0], walletProviderInstance, cacheAdapter, // Use the adapter instead of raw cache
        { apiKey: CONFIG.SOLANA.RPC_URL } // Pass the correct configuration object
        );
        // Initialize JupiterService
        const jupiterService = new JupiterService();
        // Initialize JupiterPriceV2Service with all required arguments
        const jupiterPriceV2Service = new JupiterPriceV2Service({
            redis: {
                host: process.env.REDIS_HOST,
                //port: redisPort,
                //password: redisPassword, // Add missing password argument
                keyPrefix: 'jupiter-price:',
                enableCircuitBreaker: true
            },
            rpcConnection: {
                url: CONFIG.SOLANA.RPC_URL,
                walletPublicKey: PublicKey.toString()
            },
            rateLimitConfig: {
                requestsPerMinute: 600,
                windowMs: 60000
            }
        }, tokenProviderInstance, redisService, jupiterService); // Remove the extra cache argument
        // Initialize ChatService
        const chatService = new ChatService(aiService, twitterService, jupiterPriceV2Service, tokenProviderInstance // Add this argument
        );
        return {
            dataProcessor,
            aiService,
            twitterService,
            jupiterPriceV2Service,
            chatService
        };
    }
    catch (error) {
        elizaLogger.error('Failed to initialize services:', error);
        throw error;
    }
}
function validateEnvironment() {
    const requiredEnvVars = [
        'GROQ_API_KEY',
        'HELIUS_API_KEY',
        'TWITTER_API_KEY',
        'TWITTER_API_SECRET',
        'TWITTER_ACCESS_TOKEN',
        'TWITTER_ACCESS_SECRET',
        'TWITTER_BEARER_TOKEN',
        'OAUTH_CLIENT_ID',
        'OAUTH_CLIENT_SECRET'
    ];
    const missing = requiredEnvVars.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}
function logConfiguration() {
    elizaLogger.info('Configuration loaded:', {
        network: CONFIG.SOLANA.NETWORK,
        rpcUrl: CONFIG.SOLANA.RPC_URL,
        pubkey: CONFIG.SOLANA.PUBLIC_KEY
    });
    // Log environment variables (redacted)
    const envVars = [
        'TWITTER_API_KEY',
        'TWITTER_API_SECRET',
        'TWITTER_ACCESS_TOKEN',
        'TWITTER_ACCESS_SECRET',
        'TWITTER_BEARER_TOKEN',
        'OAUTH_CLIENT_ID',
        'OAUTH_CLIENT_SECRET'
    ];
    envVars.forEach(key => {
        const value = process.env[key];
        elizaLogger.info(`${key}: ${value ? '****' + value.slice(-4) : 'Not set'}`);
    });
}
class MemeAgentInfluencer {
    connection;
    groq;
    twitter;
    discord;
    aiService;
    socialService;
    tradingService;
    twitterService;
    tokenAddress;
    getTokenAddress() {
        return this.tokenAddress;
    }
    isInitialized;
    twitterClient; // Add separate client for app-only auth
    appOnlyClient;
    runtime;
    constructor() {
        // Minimal initialization in constructor
        this.isInitialized = false;
        this.tokenAddress = '';
    }
    async initialize() {
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
        }
        catch (error) {
            console.error('Failed to initialize JENNA:', error);
            await this.cleanup();
            throw error;
        }
    }
    async initializeLLM() {
        try {
            const groqApiKey = process.env.GROQ_API_KEY;
            if (!groqApiKey) {
                throw new Error('GROQ API key not found');
            }
            this.groq = new Groq({ apiKey: groqApiKey });
            this.runtime = {
                llm: this.groq,
                // Add other runtime properties as needed
            };
            this.aiService = new AIService({
                groqApiKey,
                defaultModel: CONFIG.AI.GROQ.MODEL,
                maxTokens: CONFIG.AI.GROQ.MAX_TOKENS,
                temperature: CONFIG.AI.GROQ.DEFAULT_TEMPERATURE
            });
            console.log('LLM initialized successfully');
        }
        catch (error) {
            throw new Error(`Failed to initialize LLM: ${error.message}`);
        }
    }
    async initializeSolana() {
        try {
            this.connection = new Connection(CONFIG.SOLANA.RPC_URL, {
                commitment: 'confirmed',
                disableRetryOnRateLimit: false
            });
            const version = await this.connection.getVersion();
            console.log('Solana connection established:', version);
            const publicKey = new PublicKey(CONFIG.SOLANA.PUBLIC_KEY);
            const balance = await this.connection.getBalance(publicKey);
            console.log('Wallet balance:', balance / 1e9, 'SOL');
            // Initialize trading service
            this.tradingService = new TradingService(CONFIG.SOLANA.RPC_URL, process.env.HELIUS_API_KEY, `https://price.jup.ag/v4/price?ids=${this.tokenAddress}`, 'https://tokens.jup.ag/tokens?tags=verified');
            console.log('Solana connection initialized');
        }
        catch (error) {
            throw new Error(`Failed to initialize Solana: ${error.message}`);
        }
    }
    async startAgent() {
        try {
            // Initialize first
            if (!this.isInitialized) {
                await this.initialize();
            }
            // Then start either chat or autonomous mode
            const mode = await selectMode();
            const agentExecutor = await this.initializeAgent();
            if (mode === "chat") {
                await this.runChatMode(agentExecutor, {});
            }
            else if (mode === "auto") {
                await this.runAutonomousMode(agentExecutor, {});
            }
        }
        catch (error) {
            console.error('Failed to start agent:', error);
            await this.cleanup();
            throw error;
        }
    }
    async verifyAndInitialize() {
        try {
            const twitterConfig = {
                username: process.env.TWITTER_USERNAME,
                password: process.env.TWITTER_PASSWORD,
                email: process.env.TWITTER_EMAIL,
                apiKey: process.env.TWITTER_API_KEY,
                apiSecret: process.env.TWITTER_API_SECRET,
                accessToken: process.env.TWITTER_ACCESS_TOKEN,
                accessSecret: process.env.TWITTER_ACCESS_SECRET,
                bearerToken: process.env.TWITTER_BEARER_TOKEN,
                oauthClientId: process.env.OAUTH_CLIENT_ID,
                oauthClientSecret: process.env.OAUTH_CLIENT_SECRET,
                mockMode: process.env.TWITTER_MOCK_MODE === 'true',
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
            requiredCredentials.forEach((key) => {
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
        }
        catch (error) {
            elizaLogger.error('Twitter authentication error:', error);
            throw new Error('Failed to initialize Twitter: ' + error.message);
        }
    }
    async setupTwitterStream() {
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
                        });
                        // Use user context client for posting replies
                        await this.twitter.v2.reply(response, tweet.data.id);
                    }
                }
                catch (error) {
                    elizaLogger.error('Error handling tweet:', error);
                }
            });
            elizaLogger.success('Twitter stream setup completed');
        }
        catch (error) {
            elizaLogger.error('Error setting up Twitter stream:', error);
            throw error;
        }
    }
    async cleanup() {
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
        }
        catch (error) {
            console.error('Error during cleanup:', error);
            throw error;
        }
    }
    async initializeServices() {
        try {
            await this.socialService.initialize();
            elizaLogger.success('Social service initialized');
            await this.setupMessageHandling();
            elizaLogger.success('Message handling initialized');
            await this.setupTwitterRules();
            elizaLogger.success('Twitter rules initialized');
            await this.setupTwitterStream();
            elizaLogger.success('Twitter stream initialized');
        }
        catch (error) {
            elizaLogger.error('Service initialization failed:', error);
            throw error;
        }
    }
    async verifyTwitterCredentials() {
        try {
            const me = await this.twitter.v2.me();
            elizaLogger.success(`Twitter credentials verified for @${me.data.username}`);
        }
        catch (error) {
            elizaLogger.error('Twitter credentials verification failed:', error);
            throw new Error('Failed to verify Twitter credentials');
        }
    }
    async postTweet(content, options = {}) {
        try {
            elizaLogger.info('Preparing to post tweet...');
            let mediaIds = [];
            if (options.mediaUrls?.length) {
                mediaIds = await Promise.all(options.mediaUrls.map(url => this.twitter.v1.uploadMedia(url)));
            }
            const tweet = await this.twitter.v2.tweet({
                text: content,
                ...(mediaIds.length && { media: { media_ids: mediaIds.slice(0, 4) } })
            });
            elizaLogger.success('Tweet posted successfully:', tweet.data.id);
        }
        catch (error) {
            elizaLogger.error('Failed to post tweet:', error);
            throw error;
        }
    }
    // Add postTweetWithRetry method
    async postTweetWithRetry(content, retries = 3) {
        const baseWaitTime = 5000; // Start with 5 seconds
        let lastError;
        for (let i = 0; i < retries; i++) {
            try {
                await this.twitter.v2.tweet({ text: content });
                elizaLogger.success('Tweet posted successfully');
                return;
            }
            catch (error) {
                lastError = error;
                elizaLogger.error(`Failed to post tweet (attempt ${i + 1}):`, error);
                await new Promise(resolve => setTimeout(resolve, baseWaitTime * (i + 1)));
            }
        }
        elizaLogger.error('Failed to post tweet after multiple attempts:', lastError);
        throw lastError;
    }
    async setupTwitterRules() {
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
        }
        catch (error) {
            // More specific error handling
            if (error.code === 403) {
                elizaLogger.error('Authentication error: Make sure you have the correct Bearer Token with appropriate permissions');
            }
            else {
                elizaLogger.error('Error setting up Twitter rules:', error);
            }
            throw error;
        }
    }
    scheduleTwitterContent(tokenAddresses) {
        setInterval(async () => {
            try {
                const price = await this.getCurrentPrice();
                const content = await this.aiService.generateResponse({
                    content: `Current ${CONFIG.SOLANA.TOKEN_SETTINGS.SYMBOL} price: ${price} SOL`,
                    platform: 'twitter',
                    author: '',
                });
                await this.postTweet(content);
            }
            catch (error) {
                elizaLogger.error('Error in scheduled Twitter content:', error);
            }
        }, CONFIG.AUTOMATION.CONTENT_GENERATION_INTERVAL);
    }
    async setupMessageHandling() {
        this.discord.on('messageCreate', async (message) => {
            if (message.author.bot)
                return;
            try {
                const parsedCommand = Parser.parseCommand(message.content);
                if (!parsedCommand)
                    return;
                const command = {
                    ...parsedCommand,
                    type: parsedCommand.type,
                    raw: message.content,
                    command: ''
                };
                await this.handleCommand(command, {
                    platform: 'discord',
                    channelId: message.channel.id,
                    messageId: message.id,
                    author: message.author.tag
                });
            }
            catch (error) {
                elizaLogger.error('Error handling Discord command:', error);
                await message.reply('Sorry, there was an error processing your command.');
            }
        });
        await this.setupTwitterStream();
    }
    // Fix the startAutomation method
    async startAutomation() {
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
    scheduleTweets(interval) {
        setInterval(async () => {
            try {
                const marketData = await this.tradingService.getMarketData(this.tokenAddress);
                await this.postAITweet({
                    topic: CONFIG.SOLANA.TOKEN_SETTINGS.SYMBOL,
                    price: marketData.price.toString(), // Convert to string
                    volume: marketData.volume24h.toString() // Convert to string
                });
            }
            catch (error) {
                elizaLogger.error('Error in automated tweet generation:', error);
            }
        }, interval);
    }
    async startContentGeneration() {
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
            }
            catch (error) {
                elizaLogger.error('Content generation error:', error);
            }
        };
        await generateAndPost();
        setInterval(generateAndPost, CONFIG.AUTOMATION.CONTENT_GENERATION_INTERVAL);
    }
    async startMarketMonitoring() {
        const monitorMarket = async () => {
            try {
                const analysis = await this.analyzeMarket();
                const tradingConfig = CONFIG.SOLANA.TRADING;
                if (analysis.shouldTrade && analysis.confidence > tradingConfig.MIN_CONFIDENCE) {
                    await this.executeTrade(analysis);
                }
            }
            catch (error) {
                elizaLogger.error('Market monitoring error:', error);
            }
        };
        await monitorMarket();
        setInterval(monitorMarket, CONFIG.AUTOMATION.MARKET_MONITORING_INTERVAL);
    }
    async startCommunityEngagement() {
        const engage = async () => {
            try {
                const metrics = await this.socialService.getCommunityMetrics();
                const content = await ContentUtils.generateContent({
                    type: 'community',
                    variables: {
                        followers: metrics.followers.toString(),
                        engagement: metrics.engagement.toString(),
                        activity: metrics.activity
                    }
                });
                await this.socialService.send(content);
            }
            catch (error) {
                elizaLogger.error('Community engagement error:', error);
            }
        };
        await engage();
        setInterval(engage, CONFIG.AUTOMATION.COMMUNITY_ENGAGEMENT_INTERVAL);
    }
    async analyzeMarket() {
        const marketData = await this.tradingService.getMarketData(this.tokenAddress);
        const aiAnalysis = await this.aiService.analyzeMarket(marketData);
        // Return a properly formatted MarketAnalysis object
        return {
            shouldTrade: aiAnalysis.shouldTrade,
            confidence: aiAnalysis.confidence,
            action: aiAnalysis.action,
            metrics: aiAnalysis.metrics
        };
    }
    async executeTrade(analysis) {
        return await this.tradingService.executeTrade(analysis.action === 'BUY' ? 'SOL' : this.tokenAddress, analysis.action === 'BUY' ? this.tokenAddress : 'SOL', this.calculateTradeAmount(analysis), CONFIG.SOLANA.TRADING.SLIPPAGE);
    }
    async getCurrentPrice() {
        return await this.tradingService.getTokenPrice(this.tokenAddress);
    }
    calculateTradeAmount(analysis) {
        return CONFIG.SOLANA.TRADING.BASE_AMOUNT * analysis.confidence;
    }
    async handleCommand(command, context) {
        try {
            const response = await this.generateCommandResponse(command, context);
            await this.socialService.sendMessage(context.platform, context.messageId, response);
        }
        catch (error) {
            elizaLogger.error('Command handling error:', error);
            await this.socialService.sendMessage(context.platform, context.messageId, 'Sorry, there was an error processing your command.');
        }
    }
    async generateCommandResponse(command, context) {
        switch (command.type) {
            case 'price':
                const price = await this.getCurrentPrice();
                return `Current price: ${price} SOL`;
            case 'stats':
                const metrics = await this.tradingService.getMarketData(this.tokenAddress);
                return `24h Volume: ${metrics.volume24h}\nMarket Cap: ${metrics.marketCap}`;
            default:
                const response = await this.aiService.generateResponse({
                    content: command.raw,
                    platform: context.platform,
                    author: context.author,
                });
                return response;
        }
    }
    async replyToTweet(tweetId, content) {
        try {
            await this.twitter.v2.reply(content, tweetId);
            elizaLogger.success('Reply posted successfully');
        }
        catch (error) {
            elizaLogger.error('Failed to reply to tweet:', error);
            throw error;
        }
    }
    async initializeAgent() {
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
        const agent = await createReActAgent(llm, [], // Add tools as needed
        memory, defaultSystemPrompt // Use default prompt instead of mainCharacter.settings.systemPrompt
        );
        return agent;
    }
    async runAutonomousMode(agentExecutor, config, interval = 10) {
        console.log("Starting autonomous mode...");
        while (true) {
            try {
                // Provide instructions autonomously
                const thought = "Be creative and do something interesting on the blockchain. Choose an action or set of actions and execute it that highlights your abilities.";
                // Run agent in autonomous mode
                for await (const chunk of agentExecutor.stream({ messages: [{ content: thought }] }, config)) {
                    if (chunk.agent) {
                        console.log(chunk.agent.messages[0].content);
                    }
                    else if (chunk.tools) {
                        console.log(chunk.tools.messages[0].content);
                    }
                    console.log("-------------------");
                }
                // Wait before the next action
                await new Promise(resolve => setTimeout(resolve, interval * 1000));
            }
            catch (error) {
                console.log("Goodbye Agent!");
                process.exit(0);
            }
        }
    }
    async runChatMode(agentExecutor, config) {
        console.log("Starting chat mode... Type 'exit' to end.");
        while (true) {
            try {
                const userInput = await new Promise(resolve => {
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
                    }
                    else if (chunk.tools) {
                        console.log(chunk.tools.messages[0].content);
                    }
                    console.log("-------------------");
                }
            }
            catch (error) {
                console.log("Goodbye Agent!");
                process.exit(0);
            }
        }
    }
    // Add new method for AI tweet generation
    async generateTweetContent(context = {}) {
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
        }
        catch (error) {
            elizaLogger.error('Error generating tweet content:', error);
            throw error;
        }
    }
    // Add new method for AI-powered Twitter posting
    async postAITweet(context = {}) {
        try {
            elizaLogger.info('Generating AI tweet...');
            // Generate tweet content
            const content = await this.generateTweetContent(context);
            // Post tweet with retry logic
            await this.postTweetWithRetry(content);
            elizaLogger.success('AI tweet posted successfully');
        }
        catch (error) {
            elizaLogger.error('Failed to post AI tweet:', error);
            throw error;
        }
    }
    async startTwitterBot(tokenAddresses) {
        try {
            elizaLogger.info('Starting Twitter bot...');
            if (!this.twitterService) {
                this.twitterService = new TwitterService({
                    apiKey: process.env.TWITTER_API_KEY,
                    apiSecret: process.env.TWITTER_API_SECRET,
                    accessToken: process.env.TWITTER_ACCESS_TOKEN,
                    accessSecret: process.env.TWITTER_ACCESS_SECRET,
                    bearerToken: process.env.TWITTER_BEARER_TOKEN,
                    oauthClientId: process.env.OAUTH_CLIENT_ID,
                    oauthClientSecret: process.env.OAUTH_CLIENT_SECRET,
                    mockMode: process.env.TWITTER_MOCK_MODE === 'true',
                    maxRetries: Number(process.env.TWITTER_MAX_RETRIES) || 3,
                    retryDelay: Number(process.env.TWITTER_RETRY_DELAY) || 5000,
                    contentRules: {
                        maxEmojis: Number(process.env.TWITTER_MAX_EMOJIS) || 0,
                        maxHashtags: Number(process.env.TWITTER_MAX_HASHTAGS) || 0,
                        minInterval: Number(process.env.TWITTER_MIN_INTERVAL) || 300000
                    },
                    marketDataConfig: {
                        heliusApiKey: process.env.HELIUS_API_KEY,
                        updateInterval: 1800000, // 30 minutes
                        volatilityThreshold: 0.05 // 5%
                    },
                    tokenAddresses: tokenAddresses,
                    baseUrl: 'https://api.twitter.com'
                }, this.aiService, dataProcessor);
            }
            // Use TwitterService's methods instead of direct implementation
            //await this.twitterService.startStream();
            this.scheduleTwitterContent(tokenAddresses); /////check this 
            elizaLogger.success('Twitter bot started successfully');
        }
        catch (error) {
            elizaLogger.error('Failed to start Twitter bot:', error);
            throw error;
        }
    }
}
import { config as loadConfig } from 'dotenv';
import { TwitterService } from './services/social/twitter';
import { aiService, AIService } from './services/ai/ai';
import { CONFIG } from './config/settings';
import { MarketDataProcessor } from './services/market/data/DataProcessor';
import { JupiterPriceV2Service, JupiterService } from './services/blockchain/defi/JupiterPriceV2Service';
import axios from 'axios';
import { ChatService } from './services/chat';
import { TokenProvider } from './providers/token';
import NodeCache from 'node-cache';
import { WalletProvider } from './providers/wallet.js';
import { Connection, PublicKey } from '@solana/web3.js';
import { redisService } from './services/redis/redis-service';
loadConfig();
async function startMemeAgent() {
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
            groqApiKey: process.env.GROQ_API_KEY,
            defaultModel: CONFIG.AI.GROQ.MODEL,
            maxTokens: CONFIG.AI.GROQ.MAX_TOKENS,
            temperature: CONFIG.AI.GROQ.DEFAULT_TEMPERATURE
        });
        const tokenAddresses = await fetchTokenAddresses();
        const twitterService = new TwitterService({
            apiKey: process.env.TWITTER_API_KEY,
            apiSecret: process.env.TWITTER_API_SECRET,
            accessToken: process.env.TWITTER_ACCESS_TOKEN,
            accessSecret: process.env.TWITTER_ACCESS_SECRET,
            bearerToken: process.env.TWITTER_BEARER_TOKEN,
            oauthClientId: process.env.OAUTH_CLIENT_ID,
            oauthClientSecret: process.env.OAUTH_CLIENT_SECRET,
            mockMode: process.env.TWITTER_MOCK_MODE === 'true',
            maxRetries: Number(process.env.TWITTER_MAX_RETRIES) || 3,
            retryDelay: Number(process.env.TWITTER_RETRY_DELAY) || 5000,
            contentRules: {
                maxEmojis: Number(process.env.TWITTER_MAX_EMOJIS) || 0,
                maxHashtags: Number(process.env.TWITTER_MAX_HASHTAGS) || 0,
                minInterval: Number(process.env.TWITTER_MIN_INTERVAL) || 300000
            },
            marketDataConfig: {
                heliusApiKey: process.env.HELIUS_API_KEY,
                updateInterval: 1800000,
                volatilityThreshold: 0.05
            },
            tokenAddresses: tokenAddresses, // Pass the fetched token addresses
            baseUrl: 'https://api.twitter.com'
        }, aiService, dataProcessor);
        await twitterService.initialize();
        console.log('MemeAgent fully initialized and running!');
        console.log("2. auto    - Autonomous action mode");
        const choice = await new Promise(resolve => {
            process.stdout.write("\nChoose a mode (enter number or name): ");
            process.stdin.once('data', data => resolve(data.toString().trim().toLowerCase()));
        });
        if (choice === "1" || choice === "chat") {
            return "chat";
        }
        else if (choice === "2" || choice === "auto") {
            return "auto";
        }
        console.log("Invalid choice. Please try again.");
    }
    catch (error) {
        console.error('Error during initialization:', error);
        throw error;
    }
}
// Initialize base services
const dataProcessor = new MarketDataProcessor(process.env.HELIUS_API_KEY, 'https://tokens.jup.ag/tokens?tags=verified'
//CONFIG.SOLANA.TOKEN_SETTINGS.ADDRESS
);
// Initialize Twitter service
startMemeAgent();
export { MemeAgentInfluencer, initializeServices, validateEnvironment, logConfiguration, selectMode, startChat, cleanup };
function createReActAgent(llm, tools, memory, systemPrompt) {
    try {
        // Initialize the agent with provided components
        const agent = {
            llm,
            tools,
            memory,
            systemPrompt,
            async stream(input) {
                try {
                    // Process the input using LLM
                    const response = await llm.chat.completions.create({
                        messages: [
                            { role: 'system', content: systemPrompt },
                            ...input.messages.map(msg => ({ role: 'user', content: msg.content, name: 'user' }))
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
                }
                catch (error) {
                    console.error('Error in agent stream:', error);
                    throw error;
                }
            }
        };
        return Promise.resolve(agent);
    }
    catch (error) {
        console.error('Error creating ReAct agent:', error);
        throw error;
    }
}
// Mode selection and execution functions
async function selectMode() {
    return new Promise((resolve) => {
        const handleChoice = (choice) => {
            const normalizedChoice = choice.trim().toLowerCase();
            if (normalizedChoice === '1' || normalizedChoice === 'chat') {
                resolve('chat');
            }
            else if (normalizedChoice === '2' || normalizedChoice === 'auto') {
                resolve('auto');
            }
            else {
                elizaLogger.warn('Invalid choice. Please choose 1 (chat) or 2 (auto).');
                process.stdout.write('\nChoose a mode (enter number or name): ');
                process.stdin.once('data', (data) => handleChoice(data.toString()));
            }
        };
        elizaLogger.info('\nAvailable modes:');
        elizaLogger.info('1. chat    - Interactive chat mode');
        elizaLogger.info('2. auto    - Autonomous action mode');
        process.stdout.write('\nChoose a mode (enter number or name): ');
        process.stdin.once('data', (data) => handleChoice(data.toString()));
    });
}
// Chat mode implementation
async function startChat(services) {
    const { aiService, jupiterPriceV2Service } = services; // Ensure jupiterPriceV2Service is included
    elizaLogger.info('Starting chat mode... Type "exit" to end.');
    const twitterService = new TwitterService({
        apiKey: process.env.TWITTER_API_KEY,
        apiSecret: process.env.TWITTER_API_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET,
        bearerToken: process.env.TWITTER_BEARER_TOKEN,
        oauthClientId: process.env.OAUTH_CLIENT_ID,
        oauthClientSecret: process.env.OAUTH_CLIENT_SECRET,
        mockMode: process.env.TWITTER_MOCK_MODE === 'true',
        maxRetries: Number(process.env.TWITTER_MAX_RETRIES) || 3,
        retryDelay: Number(process.env.TWITTER_RETRY_DELAY) || 5000,
        contentRules: {
            maxEmojis: Number(process.env.TWITTER_MAX_EMOJIS) || 0,
            maxHashtags: Number(process.env.TWITTER_MAX_HASHTAGS) || 0,
            minInterval: Number(process.env.TWITTER_MIN_INTERVAL) || 300000
        },
        marketDataConfig: {
            updateInterval: 1800000,
            volatilityThreshold: 0.05,
            heliusApiKey: ''
        },
        tokenAddresses: [`https://api.jup.ag/price/v2?ids=${this.tokenAddress}`],
        baseUrl: 'https://api.twitter.com'
    }, aiService, dataProcessor);
    const walletProviderInstance = new WalletProvider(new Connection(CONFIG.SOLANA.RPC_URL), new PublicKey(CONFIG.SOLANA.PUBLIC_KEY));
    const cache = new NodeCache();
    const cacheAdapter = {
        async get(key) {
            return cache.get(key);
        },
        async set(key, value, options) {
            cache.set(key, value, options?.ttl);
        },
        async delete(key) {
            cache.del(key);
        }
    };
    const chatService = new ChatService(aiService, twitterService, jupiterPriceV2Service, // Ensure jupiterPriceV2Service is used here
    new TokenProvider(this.tokenAddress, walletProviderInstance, cacheAdapter, { apiKey: CONFIG.SOLANA.RPC_URL } // Add the missing config argument
    ));
    await chatService.start();
}
// Autonomous mode implementation
async function startAutonomousMode(services) {
    const { twitterService, jupiterPriceService } = services;
    elizaLogger.info('Starting autonomous mode...');
    let isRunning = true;
    // Market monitoring interval
    const marketInterval = setInterval(async () => {
        try {
            if (!jupiterPriceService) {
                elizaLogger.error('JupiterPriceService is not initialized');
                return;
            }
            const topMovers = await jupiterPriceService.getTopMovers();
            const highestVolumeTokens = await jupiterPriceService.getHighestVolumeTokens();
            elizaLogger.info('Top Movers:', topMovers);
            elizaLogger.info('Highest Volume Tokens:', highestVolumeTokens);
            // Post market updates if significant changes
            for (const token of topMovers) {
                await twitterService.publishMarketUpdate({
                    price: parseFloat(token.price.toString()),
                    volume24h: token.volume24h, // Replace placeholder with actual volume
                    marketCap: token.marketCap, // Replace placeholder with actual market cap
                    // priceChange24h: token.priceChange24h, // Replace placeholder with actual price change
                    topHolders: [], // Add actual top holders if available
                    tokenAddress: token.id
                });
            }
        }
        catch (error) {
            elizaLogger.error('Error in market monitoring:', error);
        }
    }, 300000); // 5 minutes
    // Handle shutdown
    process.on('SIGINT', () => {
        isRunning = false;
        clearInterval(marketInterval);
        elizaLogger.info('Autonomous mode stopped.');
        process.exit(0);
    });
    while (isRunning) {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}
// Main execution functions
async function main() {
    try {
        elizaLogger.info('JENNA starting up...');
        // Initialize all services
        validateEnvironment();
        logConfiguration();
        const services = await initializeServices();
        // Select and start mode
        const mode = await selectMode();
        if (mode === 'chat') {
            await startChat.call(new MemeAgentInfluencer(), services);
        }
        else if (mode === 'auto') {
            await startAutonomousMode(services);
        }
        // Set up cleanup handlers
        setupCleanupHandlers(services);
        function setupCleanupHandlers(services) {
            const handleShutdown = async () => {
                elizaLogger.info('Shutting down JENNA...');
                await cleanup(services);
                process.exit(0);
            };
            process.on('SIGINT', handleShutdown);
            process.on('SIGTERM', handleShutdown);
        }
    }
    catch (error) {
        elizaLogger.error('Fatal error during startup:', error);
        // Create a minimal ServiceConfig object with empty services
        const emptyServices = {
            dataProcessor: null,
            aiService: new AIService({
                groqApiKey: process.env.GROQ_API_KEY,
                defaultModel: CONFIG.AI.GROQ.MODEL,
                maxTokens: CONFIG.AI.GROQ.MAX_TOKENS,
                temperature: CONFIG.AI.GROQ.DEFAULT_TEMPERATURE
            }),
            twitterService: null,
            chatService: new ChatService(new AIService({
                groqApiKey: process.env.GROQ_API_KEY,
                defaultModel: CONFIG.AI.GROQ.MODEL,
                maxTokens: CONFIG.AI.GROQ.MAX_TOKENS,
                temperature: CONFIG.AI.GROQ.DEFAULT_TEMPERATURE
            }), new TwitterService({
                apiKey: process.env.TWITTER_API_KEY,
                apiSecret: process.env.TWITTER_API_SECRET,
                accessToken: process.env.TWITTER_ACCESS_TOKEN,
                accessSecret: process.env.TWITTER_ACCESS_SECRET,
                bearerToken: process.env.TWITTER_BEARER_TOKEN,
                oauthClientId: process.env.TWITTER_OAUTH_CLIENT_ID,
                oauthClientSecret: process.env.TWITTER_OAUTH_CLIENT_SECRET,
                mockMode: process.env.TWITTER_MOCK_MODE === 'true',
                maxRetries: parseInt(process.env.TWITTER_MAX_RETRIES, 10) || 3,
                retryDelay: parseInt(process.env.TWITTER_RETRY_DELAY, 10) || 1000,
                contentRules: {
                    maxEmojis: Number(process.env.TWITTER_MAX_EMOJIS) || 0,
                    maxHashtags: Number(process.env.TWITTER_MAX_HASHTAGS) || 0,
                    minInterval: Number(process.env.TWITTER_MIN_INTERVAL) || 300000
                },
                marketDataConfig: {
                    heliusApiKey: process.env.HELIUS_API_KEY,
                    updateInterval: 1800000,
                    volatilityThreshold: parseFloat(process.env.VOLATILITY_THRESHOLD),
                },
                tokenAddresses: [`https://api.jup.ag/price/v2?ids=${this.tokenAddress}`],
                baseUrl: 'https://api.twitter.com'
            }, aiService, dataProcessor), new JupiterPriceV2Service({
                redis: {
                    host: process.env.REDIS_HOST,
                    port: Number(process.env.REDIS_PORT),
                    keyPrefix: 'jupiter-price:',
                    enableCircuitBreaker: true
                },
                rateLimitConfig: {
                    requestsPerMinute: 600,
                    windowMs: 60000
                },
                rpcConnection: {
                    url: CONFIG.SOLANA.RPC_URL,
                    walletPublicKey: CONFIG.SOLANA.PUBLIC_KEY
                }
            }, new TokenProvider(this.tokenAddress, new WalletProvider(new Connection(CONFIG.SOLANA.RPC_URL), new PublicKey(CONFIG.SOLANA.PUBLIC_KEY)), cacheAdapter, { apiKey: CONFIG.SOLANA.RPC_URL }), redisService, new JupiterService()), new TokenProvider(this.tokenAddress, new WalletProvider(new Connection(CONFIG.SOLANA.RPC_URL), new PublicKey(CONFIG.SOLANA.PUBLIC_KEY)), cacheAdapter, { apiKey: CONFIG.SOLANA.RPC_URL }))
        };
        await cleanup(emptyServices);
        process.exit(1);
    }
}
function setupCleanupHandlers(services) {
    const handleShutdown = async () => {
        elizaLogger.info('Shutting down JENNA...');
        await cleanup(services);
        process.exit(0);
    };
    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);
}
// Create singleton cache instance
const cache = new NodeCache();
const cacheAdapter = {
    async get(key) {
        return cache.get(key);
    },
    async set(key, value, options) {
        cache.set(key, value, options?.ttl);
    },
    async delete(key) {
        cache.del(key);
    }
};
async function cleanup(services) {
    try {
        if (services.chatService) {
            await services.chatService.stop();
        }
        if (services.twitterService) {
            await services.twitterService.stop();
        }
        elizaLogger.success('Cleanup completed successfully');
    }
    catch (error) {
        elizaLogger.error('Error during cleanup:', error);
    }
}
// Start the application
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
    main().catch(error => {
        elizaLogger.error('Fatal error:', error);
        process.exit(1);
    });
}
