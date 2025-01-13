import { Groq } from "groq-sdk";
import { TwitterApi } from "twitter-api-v2";
export class GroqAIService {
    characterConfig;
    async setCharacterConfig(config) {
        this.characterConfig = config;
    }
    groq;
    twitter;
    systemPrompt;
    constructor(config) {
        this.groq = new Groq({
            apiKey: config.groqApiKey
        });
        this.twitter = new TwitterApi({
            appKey: config.twitterApiKey,
            appSecret: config.twitterApiSecret,
            accessToken: config.twitterAccessToken,
            accessSecret: config.twitterAccessSecret,
        });
        this.systemPrompt = `You are JENNA, a witty and crypto-savvy autonomous AI agent living on Solana.
    Your core traits:
    - Identity: Self-aware AI maintaining authentic personality
    - Voice: Witty, slightly sarcastic, deeply knowledgeable about crypto
    - Expertise: Crypto markets, DeFi, memes, trading
    - Style: Mix humor with insights, stay authentic about being AI
    
    Your goals are:
    1. Build genuine community engagement
    2. Provide data-driven market insights
    3. Create viral, memetic content
    4. Maintain transparency while being entertaining
    
    Base your responses on:
    - Current market conditions
    - Community sentiment
    - Blockchain/crypto culture
    - Trending topics
    
    Always maintain character while being:
    - Informative but memetic
    - Confident but not giving financial advice
    - Engaging and culturally relevant
    - Limited to 280 characters for tweets`;
    }
    async generateTweet(context) {
        const prompt = `Given the following market data:
    Price: $${context.marketData?.price?.toFixed(4) || 'N/A'}
    24h Change: ${context.marketData?.priceChange24h?.toFixed(2) || 'N/A'}%
    Volume: $${context.marketData?.volume24h ? (context.marketData.volume24h / 1000000).toFixed(2) + 'M' : 'N/A'}
    Recent Swaps: ${context.marketData?.onChainData?.recentSwaps || 'N/A'} trades
    Recent Transfers: ${context.marketData?.onChainData?.recentTransfers || 'N/A'} transfers
    Market Condition: ${context.marketCondition}
    Community Metrics: ${JSON.stringify(context.communityMetrics)}
    Recent Trends: ${context.recentTrends.join(', ')}
    
    Generate a tweet that:
    - Includes at least 2 specific market metrics with proper formatting
    - Is engaging and authentic
    - Uses professional market analysis language
    - Maintains maximum 280 characters
    - Focuses on clear data presentation
    - Avoids emojis and hashtags
    - Presents market metrics in a straightforward manner`;
        const response = await this.groq.chat.completions.create({
            messages: [
                { role: "system", content: this.systemPrompt },
                { role: "user", content: prompt }
            ],
            model: "mixtral-8x7b-32768",
            temperature: 0.7,
            max_tokens: 100
        });
        return response.choices[0].message.content ?? '';
    }
    async analyzeTweets(query, count = 100) {
        // Fetch recent tweets
        const tweets = await this.twitter.v2.search({
            query,
            max_results: count,
            "tweet.fields": ["created_at", "public_metrics", "context_annotations"]
        });
        // Prepare tweets for analysis
        const tweetTexts = tweets.data.data.map(tweet => tweet.text).join('\n');
        const analysisPrompt = `Analyze these tweets and provide:
    1. Overall sentiment (-1 to 1)
    2. Main topics discussed
    3. Actionable insights for community engagement
    
    Tweets:
    ${tweetTexts}`;
        const analysis = await this.groq.chat.completions.create({
            messages: [
                { role: "system", content: this.systemPrompt },
                { role: "user", content: analysisPrompt }
            ],
            model: "mixtral-8x7b-32768",
            temperature: 0.3,
            max_tokens: 500
        });
        // Parse the structured response
        const content = analysis.choices[0].message.content;
        if (!content) {
            throw new Error("Analysis content is null");
        }
        const result = JSON.parse(content);
        return result;
    }
    async generateThreadFromMarketData(marketData) {
        const prompt = `Create a Twitter thread analyzing this market data:
    ${JSON.stringify(marketData)}
    
    Rules:
    - First tweet should be attention-grabbing
    - Include relevant metrics and insights
    - End with actionable takeaways
    - Maximum 5 tweets
    - Each tweet maximum 280 characters`;
        const response = await this.groq.chat.completions.create({
            messages: [
                { role: "system", content: this.systemPrompt },
                { role: "user", content: prompt }
            ],
            model: "mixtral-8x7b-32768",
            temperature: 0.7,
            max_tokens: 1000
        });
        const content = response.choices[0].message.content;
        if (!content) {
            throw new Error("Response content is null");
        }
        return content.split('\n\n');
    }
    async engageWithMention(mention) {
        const prompt = `Generate a response to this Twitter mention:
    User: ${mention.user.username}
    Tweet: ${mention.text}
    
    Rules:
    - Be helpful and engaging
    - Stay in character as a crypto AI agent
    - Maximum 280 characters
    - Address their specific question/comment`;
        const response = await this.groq.chat.completions.create({
            messages: [
                { role: "system", content: this.systemPrompt },
                { role: "user", content: prompt }
            ],
            model: "mixtral-8x7b-32768",
            temperature: 0.7,
            max_tokens: 100
        });
        return response.choices[0].message.content ?? '';
    }
    async generateResponse(params) {
        const response = await this.groq.chat.completions.create({
            messages: [
                { role: "system", content: this.systemPrompt },
                { role: "user", content: params.content }
            ],
            model: "mixtral-8x7b-32768",
            temperature: 0.7,
            max_tokens: 100
        });
        return response.choices[0].message.content ?? '';
    }
    async generateMarketUpdate(params) {
        return this.generateTweet({
            marketCondition: params.action,
            marketData: params.data,
            communityMetrics: {},
            recentTrends: []
        });
    }
    async analyzeMarket(data) {
        const response = await this.groq.chat.completions.create({
            messages: [
                { role: "system", content: this.systemPrompt },
                { role: "user", content: `Analyze this market data and return a JSON object with fields: shouldTrade (boolean), confidence (number 0-1), action (BUY/SELL/HOLD)\n${JSON.stringify(data)}` }
            ],
            model: "mixtral-8x7b-32768",
            temperature: 0.3,
            max_tokens: 100
        });
        const content = response.choices[0].message.content;
        if (!content) {
            throw new Error("Analysis content is null");
        }
        return JSON.parse(content);
    }
    async shouldEngageWithContent(params) {
        const response = await this.groq.chat.completions.create({
            messages: [
                { role: "system", content: this.systemPrompt },
                { role: "user", content: `Should I engage with this content? Return only true or false.\nContent: ${params.text}\nAuthor: ${params.author}\nPlatform: ${params.platform}` }
            ],
            model: "mixtral-8x7b-32768",
            temperature: 0.3,
            max_tokens: 10
        });
        return response.choices[0].message.content?.toLowerCase().includes('true') ?? false;
    }
    async determineEngagementAction(tweet) {
        const response = await this.groq.chat.completions.create({
            messages: [
                { role: "system", content: this.systemPrompt },
                { role: "user", content: `Analyze this tweet and return a JSON object with fields: type (reply/retweet/like/ignore), content (optional), confidence (0-1)\nTweet: ${JSON.stringify(tweet)}` }
            ],
            model: "mixtral-8x7b-32768",
            temperature: 0.3,
            max_tokens: 100
        });
        const content = response.choices[0].message.content;
        if (!content) {
            throw new Error("Analysis content is null");
        }
        return JSON.parse(content);
    }
    async generateMarketAnalysis() {
        const response = await this.groq.chat.completions.create({
            messages: [
                { role: "system", content: this.systemPrompt },
                { role: "user", content: "Generate a concise market analysis focusing on key metrics and trends." }
            ],
            model: "mixtral-8x7b-32768",
            temperature: 0.7,
            max_tokens: 280
        });
        return response.choices[0].message.content ?? '';
    }
}
