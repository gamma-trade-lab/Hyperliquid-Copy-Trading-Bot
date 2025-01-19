import CONFIG from "../../src/config/settings";
import { MarketAnalysis, MarketMetrics } from "../../src/services/blockchain/types.js";
import { elizaLogger } from "@ai16z/eliza";
import Groq from "groq-sdk";

interface AIServiceConfig {
  groqApiKey: string;
  defaultModel: string;
  maxTokens: number;
  temperature: number;
}

interface GenerateResponseParams {
  content: string;
  author: string;
  platform: string;
  messageId: string;
}

interface MarketContext {
  tokens: any[];
  timestamp: number;
  isAlert?: boolean;
}

interface MarketData extends MarketMetrics {
  priceChange24h: number;
  momentum: number; // Add missing properties
  strength: number; // Add missing properties
}

export class AIService {
  private groq: Groq;
  private readonly sentimentPrompts = {
    positive: ['bullish', 'growth', 'adoption', 'partnership'],
    negative: ['bearish', 'decline', 'risk', 'concern']
  };

  constructor(config: AIServiceConfig) {
    this.groq = new Groq({
      apiKey: config.groqApiKey
    });   
  }

  getMarketMetrics() {
    throw new Error('Method not implemented.');
  }

  async analyzeSentiment(text: string): Promise<number> {
    try {
      const prompt = `
        Analyze the sentiment of the following text and rate it on a scale of 0 to 1,
        where 0 is extremely negative and 1 is extremely positive.
        Consider market context, technical analysis terms, and crypto-specific language.

        Text: "${text}"

        Provide just the numerical score.
      `;

      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'mixtral-8x7b-32768',
        temperature: 0.3,
      });

      const score = parseFloat(completion.choices[0]?.message?.content || "0.5");
      return isNaN(score) ? 0.5 : score;
    } catch (error) {
      elizaLogger.error('Error analyzing sentiment:', error);
      return 0.5;
    }
  }

  async generateName(): Promise<string> {
    try {
      const prompt = `
        Generate a creative and memorable name for a new cryptocurrency token.
        The name should be:
        - Unique and catchy
        - Easy to remember
        - Not similar to existing major tokens
        - Maximum 15 characters
        
        Provide just the name, no explanation.
      `;

      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'mixtral-8x7b-32768',
        temperature: 0.9,
      });

      return completion.choices[0]?.message?.content?.trim() || "TokenName";
    } catch (error) {
      elizaLogger.error('Error generating name:', error);
      return "TokenName";
    }
  }

  async generateNarrative(template: any): Promise<string> {
    try {
      const prompt = `
        Create a compelling narrative for a cryptocurrency token with the following attributes:
        Name: ${template.name}
        Type: ${template.type}
        Key Features: ${template.features?.join(', ')}
        
        Generate a concise, engaging description that highlights unique value propositions
        and use cases. Keep it under 280 characters for Twitter compatibility.
      `;

      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'mixtral-8x7b-32768',
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content?.trim() || "";
    } catch (error) {
      elizaLogger.error('Error generating narrative:', error);
      return "";
    }
  }

  async analyzeMarket(tokenAddress: string): Promise<MarketAnalysis> {
    try {
      const marketData = await this.fetchMarketData(tokenAddress);
      
      const prompt = `
        Analyze the following market data and provide a detailed assessment:
        Price: ${marketData.price}
        24h Change: ${marketData.priceChange24h}%
        Volume: ${marketData.volume24h}
        Market Cap: ${marketData.marketCap}

        Consider:
        1. Price action and volatility
        2. Volume patterns
        3. Market sentiment
        4. Risk factors

        Format the response as JSON with the following structure:
        {
          "sentiment": "BULLISH/BEARISH/NEUTRAL",
          "confidence": 0-1,
          "shouldTrade": boolean,
          "action": "BUY/SELL/HOLD",
          "reasons": ["reason1", "reason2"],
          "riskLevel": "LOW/MEDIUM/HIGH",
          "metrics": {
            "volatility": number,
            "momentum": number,
            "strength": number
          }
        }
      `;

      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'mixtral-8x7b-32768',
        temperature: 0.3,
      });

      const analysis = JSON.parse(completion.choices[0]?.message?.content || "{}");
      
      return {
        summary: "Market analysis summary",
        sentiment: analysis.sentiment || "NEUTRAL",
        keyPoints: [],
        recommendation: null,
        confidence: analysis.confidence || 0.5,
        shouldTrade: analysis.shouldTrade || false,
        action: analysis.action || "HOLD",
        reasons: analysis.reasons || [],
        riskLevel: analysis.riskLevel || "MEDIUM",
        metrics: {
          price: marketData.price,
          volume24h: marketData.volume24h,
          marketCap: marketData.marketCap,
          volatility: analysis.metrics?.volatility || 0,
          momentum: analysis.metrics?.momentum || 0,
          strength: analysis.metrics?.strength || 0,
          confidence: analysis.metrics?.confidence || 0,
          onChainData: analysis.metrics?.onChainData || {}
        }
      };
    } catch (error) {
      elizaLogger.error('Error analyzing market:', error);
      return {
        summary: "Error analyzing market",
        sentiment: "NEUTRAL",
        keyPoints: [],
        recommendation: null,
        confidence: 0,
        shouldTrade: false,
        action: "HOLD",
        reasons: ["Error analyzing market"],
        riskLevel: "HIGH",
        metrics: {
          price: 0,
          volume24h: 0,
          marketCap: 0,
          volatility: 0,
          momentum: 0,
          strength: 0,
          confidence: 0,
          onChainData: {}
        }
      };
    }
  }

  async generateResponse(params: GenerateResponseParams): Promise<string> {
    try {
      const prompt = `
        Generate a response for the following content on ${params.platform}:
        "${params.content}"

        Author: ${params.author}
        Context: Cryptocurrency and trading discussion
        
        Requirements:
        - Professional and knowledgeable tone
        - Include relevant market insights if applicable
        - Keep it concise and engaging
        - Avoid sensitive topics
        - Match the platform's style (${params.platform})
      `;

      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'mixtral-8x7b-32768',
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content?.trim() || "Generated Response";
    } catch (error) {
      elizaLogger.error('Error generating response:', error);
      return "";
    }
  }

  async generateMarketUpdate(context: MarketContext): Promise<string> {
    try {
      const tokenData = context.tokens.map(token => 
        `${token.symbol}: $${token.price} (${token.priceChange24h}% 24h)`
      ).join('\n');

      const prompt = `
        Create a market update tweet based on the following data:
        ${tokenData}

        Requirements:
        - Professional and informative tone
        - Highlight significant price movements
        - Include relevant market context
        - Maximum 280 characters
        - Use appropriate emojis sparingly
        ${context.isAlert ? '- Emphasize urgency and importance' : ''}
      `;

      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'mixtral-8x7b-32768',
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content?.trim() || "";
    } catch (error) {
      elizaLogger.error('Error generating market update:', error);
      return this.generateFallbackUpdate(context.tokens);
    }
  }

  private generateFallbackUpdate(tokens: any[]): string {
    const updates = tokens.map(token => 
      `${token.symbol}: $${token.price.toFixed(3)} (${token.priceChange24h.toFixed(2)}%)`
    ).join('\n');
    
    return `Market Update 📊\n${updates}`;
  }

  shouldEngageWithContent(content: string): boolean {
    // Check for engagement criteria
    const engagementTriggers = [
      'token',
      'crypto',
      'blockchain',
      'defi',
      'market',
      'trading'
    ];

    return engagementTriggers.some(trigger => 
      content.toLowerCase().includes(trigger)
    );
  }

  determineEngagementAction(content: string): string {
    const sentiment = this.quickSentimentCheck(content);
    if (sentiment > 0.7) return 'LIKE_AND_RETWEET';
    if (sentiment > 0.4) return 'LIKE';
    return 'NONE';
  }

  private quickSentimentCheck(content: string): number {
    const contentLower = content.toLowerCase();
    const positiveCount = this.sentimentPrompts.positive.filter(word => 
      contentLower.includes(word)
    ).length;
    const negativeCount = this.sentimentPrompts.negative.filter(word => 
      contentLower.includes(word)
    ).length;

    const total = positiveCount + negativeCount;
    if (total === 0) return 0.5;
    return positiveCount / total;
  }

  private async fetchMarketData(tokenAddress: string): Promise<MarketData> {
    // Implement market data fetching logic
    // This should be replaced with actual market data API calls
    return {
      price: 0,
      priceChange24h: 0,
      volume24h: 0,
      marketCap: 0,
      volatility: 0,
      momentum: 0, // Ensure these properties are included
      strength: 0, // Ensure these properties are included
      confidence: 0,
      onChainData: {}
    };
  }
}

// Export singleton instance
export const aiService = new AIService({
  groqApiKey: CONFIG.AI.GROQ.API_KEY,
  defaultModel: CONFIG.AI.GROQ.MODEL,
  maxTokens: CONFIG.AI.GROQ.MAX_TOKENS,
  temperature: CONFIG.AI.GROQ.DEFAULT_TEMPERATURE
});

export default aiService;