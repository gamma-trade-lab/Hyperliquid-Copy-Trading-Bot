import axios from 'axios';
import { personalityConfig } from '../../config/personality';
import { AIModel, MarketAction } from '../../config/constants';
import { Connection, PublicKey } from '@solana/web3.js';

interface KuzcoConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  walletAddress: string;
}

interface GenerationParams {
  prompt: string;
  context?: any;
  maxLength?: number;
  temperature?: number;
}

interface MarketAnalysis {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  summary: string;
  keyMetrics: {
    price: number;
    volume: number;
    momentum: number;
  };
  recommendations: string[];
}

export class KuzcoService {
  private apiKey: string;
  private connection: Connection;
  private walletAddress: PublicKey;
  private personality: typeof personalityConfig;

  constructor(config: KuzcoConfig) {
    this.apiKey = config.apiKey;
    this.connection = new Connection(process.env.HELIUS_RPC_URL!);
    this.walletAddress = new PublicKey(config.walletAddress);
    this.personality = personalityConfig;
  }

  async generateContent(params: GenerationParams): Promise<string> {
    try {
      // Prepare system prompt with personality
      const systemPrompt = this.buildSystemPrompt();
      
      // Calculate estimated cost
      const estimatedCost = this.estimateInferenceCost(params.prompt);
      
      // Check wallet balance
      const balance = await this.checkWalletBalance();
      if (balance < estimatedCost) {
        throw new Error('Insufficient funds for inference');
      }

      const response = await axios.post('https://api.kuzco.xyz/completions', {
        model: 'mixtral-8x7b-32768',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: params.prompt }
        ],
        max_tokens: params.maxLength || 500,
        temperature: params.temperature || 0.7,
        wallet_address: this.walletAddress.toString(),
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Error generating content:', error);
      throw error;
    }
  }

  async analyzeMarket(data: any): Promise<MarketAnalysis> {
    const prompt = `Analyze the following market data and provide structured insights:
      Price: ${data.price}
      24h Volume: ${data.volume}
      Market Cap: ${data.marketCap}
      Recent Trends: ${data.trends.join(', ')}
      
      Provide analysis in the following format:
      - Overall sentiment (bullish/bearish/neutral)
      - Confidence level (0-1)
      - Summary
      - Key metrics
      - Trading recommendations`;

    try {
      const response = await this.generateContent({ prompt });
      return JSON.parse(response) as MarketAnalysis;
    } catch (error) {
      console.error('Error analyzing market:', error);
      throw error;
    }
  }

  async generateSocialPost(context: {
    marketCondition: MarketAction;
    communityMetrics: any;
    recentTrends: string[];
  }): Promise<string> {
    const template = this.selectResponseTemplate(context);
    const prompt = `Generate a social media post based on:
      Market Condition: ${context.marketCondition}
      Community Metrics: ${JSON.stringify(context.communityMetrics)}
      Recent Trends: ${context.recentTrends.join(', ')}
      
      Use this template style: ${template}
      Maintain the personality traits: ${this.personality.core.baseTraits.map(t => t.name).join(', ')}`;

    return this.generateContent({ prompt });
  }

  async generateTradeAnalysis(tradeData: any): Promise<string> {
    const prompt = `Analyze this trade opportunity:
      Token: ${tradeData.token}
      Current Price: ${tradeData.price}
      24h Change: ${tradeData.priceChange}
      Volume: ${tradeData.volume}
      
      Provide analysis considering:
      1. Technical indicators
      2. Market sentiment
      3. Risk assessment
      4. Potential profit/loss scenarios`;

    return this.generateContent({ 
      prompt,
      temperature: 0.3, // Lower temperature for more analytical responses
    });
  }

  private buildSystemPrompt(): string {
    return `You are ${this.personality.core.name}, ${this.personality.core.description}
    
    Key traits:
    ${this.personality.core.baseTraits.map(trait => 
      `- ${trait.name}: ${trait.description}`
    ).join('\n')}
    
    Voice and tone:
    - ${this.personality.core.voice.tone}
    - ${this.personality.core.voice.style}
    
    Use these crypto-native terms when appropriate:
    ${this.personality.core.voice.vocabulary.join(', ')}`;
  }

  private selectResponseTemplate(context: any): string {
    const templates = this.personality.responses;
    const marketCondition = context.marketCondition;
    
    // Select appropriate template based on context
    return templates.marketAnalysis.find(t => 
      t.conditions?.marketCondition === marketCondition
    )?.templates[0] || templates.marketAnalysis[0].templates[0];
  }

  private estimateInferenceCost(prompt: string): number {
    // Implement cost estimation based on token count
    const estimatedTokens = prompt.length / 4; // Rough estimation
    const costPerToken = 0.000001; // Example rate
    return estimatedTokens * costPerToken;
  }

  private async checkWalletBalance(): Promise<number> {
    try {
      const balance = await this.connection.getBalance(this.walletAddress);
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      console.error('Error checking wallet balance:', error);
      throw error;
    }
  }

  async getCurrentVersions(): Promise<any> {
    try {
      const response = await axios.get('https://relay.kuzco.xyz/public/versions');
      return response.data;
    } catch (error) {
      console.error('Error fetching current versions:', error);
      throw error;
    }
  }

  async getNetworkHardware(): Promise<any> {
    try {
      const response = await axios.get('https://relay.kuzco.xyz/public/hardware');
      return response.data;
    } catch (error) {
      console.error('Error fetching network hardware:', error);
      throw error;
    }
  }
}