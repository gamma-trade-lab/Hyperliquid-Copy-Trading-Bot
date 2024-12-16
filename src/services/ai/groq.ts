import { Groq } from "groq-sdk";
import { TwitterApi } from "twitter-api-v2";

interface TweetAnalysis {
  sentiment: number;
  topics: string[];
  actionableInsights: string[];
}

export class GroqAIService {
  private groq: Groq;
  private twitter: TwitterApi;
  private systemPrompt: string;

  constructor(config: {
    groqApiKey: string;
    twitterApiKey: string;
    twitterApiSecret: string;
    twitterAccessToken: string;
    twitterAccessSecret: string;
  }) {
    this.groq = new Groq({
      apiKey: config.groqApiKey
    });

    this.twitter = new TwitterApi({
      appKey: config.twitterApiKey,
      appSecret: config.twitterApiSecret,
      accessToken: config.twitterAccessToken,
      accessSecret: config.twitterAccessSecret,
    });

    this.systemPrompt = `You are a crypto-native AI agent specializing in memecoin community management and social engagement.
    Your goals are:
    1. Build and engage with the community
    2. Provide market insights
    3. Create viral content
    4. Maintain transparency about being an AI
    Base your responses on blockchain and crypto culture while staying authentic.`;
  }

  async generateTweet(context: {
    marketCondition: string;
    communityMetrics: any;
    recentTrends: string[];
  }): Promise<string> {
    const prompt = `Given the following context:
    Market Condition: ${context.marketCondition}
    Community Metrics: ${JSON.stringify(context.communityMetrics)}
    Recent Trends: ${context.recentTrends.join(', ')}
    
    Generate a tweet that is:
    - Engaging and authentic
    - Related to current market conditions
    - Community-focused
    - Uses appropriate crypto twitter language
    - Maximum 280 characters`;

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

  async analyzeTweets(query: string, count: number = 100): Promise<TweetAnalysis> {
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
    return result as TweetAnalysis;
  }

  async generateThreadFromMarketData(marketData: any): Promise<string[]> {
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

  async engageWithMention(mention: any): Promise<string> {
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
}