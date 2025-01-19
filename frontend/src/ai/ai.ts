import {CONFIG} from "../config/settings";
import { MarketAnalysis, MarketMetrics } from "../../../src/services/blockchain/types.js";


import { Message, streamCompletion, validateApiKey } from '@/utils/groq';
import logger from "@/utils/logger";
import { validateSolanaAddress, validateTransactionHash } from '@/utils/validation';
import { getSolanaPrice, getTrendingSolanaTokens } from '@/utils/coingecko';
import { getTransactionDetails, getSolanaBalance } from '@/utils/helius';
import { executeSwap, fetchTokenInfo, getTokenInfo, swapSolToToken } from '@/utils/jup';
import { getTrendingTokens } from '@/utils/birdeye';
import { agentWallet } from '@/utils/wallet';
import { getAssetsByOwner } from '@/tools/helius/get_assets_by_owner';
import { requestDevnetAirdrop } from '@/utils/airdrop';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import { fetchPrice } from '@/tools/jupiter/fetch_price';
import type { Portfolio } from '@/types/portfolio';
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
  tokens: Array<{ symbol: string; price: number; priceChange24h: number }>;
  timestamp: number;
  isAlert?: boolean;
}

interface MarketData extends MarketMetrics {
  priceChange24h: number;
  momentum: number; // Add missing properties
  strength: number; // Add missing properties
}

interface ChatCommand {
  type: 'price' | 'market' | 'trade' | 'wallet' | 'info' | 'portfolio' | 'airdrop' | 'trending';
  args: string[];
}

export class AIService {
  private groq: Groq;
  private readonly sentimentPrompts = {
    positive: ['bullish', 'growth', 'adoption', 'partnership'],
    negative: ['bearish', 'decline', 'risk', 'concern']
  };
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  private readonly commandPatterns = {
    price: /(?:what(?:'s| is) the |get |show |check )?(?:price|value|worth|cost)\s+(?:of\s+)?(\S+)/i,
    market: /(?:show |get |check |analyze )?(?:market|trend|analysis|overview)\s+(?:for\s+)?(\S+)?/i,
    trade: /(?:let's |please |can you )?(?:trade|swap|buy|sell)\s+(\d+(?:\.\d+)?)\s+(\S+)/i,
    wallet: /(?:show |get |check )?(?:wallet|balance|holdings)\s+(?:for\s+)?(\S+)?/i,
    info: /(?:what |show |tell me |get )?(?:info|details|about)\s+(\S+)/i,
    portfolio: /(?:show |create |analyze )?(?:my |the )?portfolio/i,
    airdrop: /(?:request |get |send )?(?:airdrop)/i,
    trending: /(?:show |get |what are |list )?(?:trending tokens|top tokens)/i
  };

  constructor(config: AIServiceConfig) {
    this.groq = new Groq({
      apiKey: config.groqApiKey,
      //environment: 'browser', // Ensure environment is set to browser
      dangerouslyAllowBrowser: true // Enable this option
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
      logger.error('Error analyzing sentiment:', error);
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
      logger.error('Error generating name:', error);
      return "TokenName";
    }
  }

  async generateNarrative(template: { name: string; type: string; features?: string[] }): Promise<string> {
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
      logger.error('Error generating narrative:', error);
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
      logger.error('Error analyzing market:', error);
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
      logger.error('Error generating response:', error);
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
      logger.error('Error generating market update:', error);
      return this.generateFallbackUpdate(context.tokens);
    }
  }

  private generateFallbackUpdate(tokens: Array<{ symbol: string; price: number; priceChange24h: number }>): string {
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

  private async fetchMarketData(_tokenAddress: string): Promise<MarketData> {
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

  async streamChatResponse(
    message: string, 
    onChunk: (text: string) => void,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      const command = this.parseCommand(message);
      if (command) {
        const response = await this.executeCommand(command, context);
        onChunk(response);
        return;
      }

      const messages: Message[] = [{
        role: 'user',
        content: message
      }];

      if (context) {
        messages.unshift({
          role: 'system',
          content: `Context: ${JSON.stringify(context)}`
        });
      }

      await streamCompletion(messages, onChunk);

    } catch (error) {
      logger.error('Error streaming chat response:', error);
      onChunk('I encountered an error. Please try again.');
    }
  }

  parseCommand(message: string): ChatCommand | null {
    // Implement command parsing logic
    return null;
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      return await validateApiKey(apiKey);
    } catch (error) {
      logger.error('Error validating API key:', error);
      return false;
    }
  }

  private async executeCommand(
    command: ChatCommand, 
    context?: Record<string, any>
  ): Promise<string> {
    try {
      switch (command.type) {
        case 'portfolio':
          return await this.handlePortfolioCommand(context?.walletAddress);
        case 'airdrop':
          return await this.handleAirdropCommand(command.args[0]);
        case 'trending':
          return await this.handleTrendingCommand();
        default:
          return 'Command not recognized';
      }
    } catch (error) {
      logger.error('Command execution error:', error);
      return 'Error executing command. Please try again.';
    }
  }

  private async handlePortfolioCommand(walletAddress?: string): Promise<string> {
    try {
      if (!walletAddress) {
        return 'Wallet address is required for portfolio analysis';
      }

      const portfolio: Portfolio = await getAssetsByOwner(null, new PublicKey(walletAddress));
      return `Portfolio Analysis for ${walletAddress}:\n` +
             portfolio.assets.map(asset => 
               `${asset.symbol}: ${asset.amount.toFixed(4)} tokens`
             ).join('\n');
    } catch (error) {
      logger.error('Portfolio command error:', error);
      return 'Error analyzing portfolio';
    }
  }

  private async handleAirdropCommand(address: string): Promise<string> {
    try {
      if (!validateSolanaAddress(address)) {
        return 'Invalid wallet address';
      }

      const airdropResult = await requestDevnetAirdrop(address);
      return `Airdrop ${airdropResult.status}: ${airdropResult.message}`;
    } catch (error) {
      logger.error('Airdrop command error:', error);
      return 'Error requesting airdrop';
    }
  }

  private async handleTrendingCommand(): Promise<string> {
    try {
      const [birdeyeTrending, solTrending] = await Promise.all([
        getTrendingTokens(),
        getTrendingSolanaTokens()
      ]);

      return 'Trending Tokens:\n\n' +
             birdeyeTrending.slice(0, 5).map((token, i) =>
               `${i + 1}. ${token.name}\n` +
               `   Price: $${token.v24hUSD.toFixed(6)}\n` +
               `   24h Change: ${token.v24hChangePercent.toFixed(2)}%`
             ).join('\n\n');
    } catch (error) {
      logger.error('Trending command error:', error);
      return 'Error fetching trending tokens';
    }
  }

  async streamMarketAnalysis(
    tokenAddress: string,
    onChunk: (text: string) => void
  ): Promise<void> {
    try {
      const marketData = await this.fetchMarketData(tokenAddress);
      
      const messages: Message[] = [{
        role: 'user',
        content: `
          Analyze this market data and provide insights:
          Token: ${tokenAddress}
          Price: $${marketData.price}
          24h Change: ${marketData.priceChange24h}%
          Volume: $${marketData.volume24h}
          Market Cap: $${marketData.marketCap}

          Provide analysis in a clear, conversational format.
        `
      }];

      await streamCompletion(messages, onChunk);
    } catch (error) {
      logger.error('Error streaming market analysis:', error);
      onChunk('Error analyzing market data. Please try again.');
    }
  }

  async executeTrade(params: { tokenAddress: string; action: string; amount: number }): Promise<string> {
    try {
      const analysis = await this.analyzeMarket(params.tokenAddress);
      
      if (!analysis.shouldTrade || analysis.confidence < 0.7) {
        return `Trade not recommended at this time.\nReason: ${analysis.reasons[0]}\nConfidence: ${(analysis.confidence * 100).toFixed(1)}%`;
      }

      return `Trade Analysis:
        Action: ${params.action.toUpperCase()}
        Amount: ${params.amount}
        Token: ${params.tokenAddress}
        Confidence: ${(analysis.confidence * 100).toFixed(1)}%
        Risk Level: ${analysis.riskLevel}
        
        Market Summary:
        ${analysis.summary}`;
    } catch (error) {
      logger.error('Error executing trade:', error);
      return 'Error executing trade. Please try again.';
    }
  }

  private formatSentiment(sentiment: number): string {
    if (sentiment >= 0.7) return '🟢 Bullish';
    if (sentiment <= 0.3) return '🔴 Bearish';
    return '🟡 Neutral';
  }

  async getTransactionDetails(transactionHash: string) {
    try {
      const details = await getTransactionDetails(transactionHash);
      return details;
    } catch (error) {
      logger.error('Error fetching transaction details:', error);
      return null;
    }
  }

  async getSolanaBalance(walletAddress: string) {
    try {
      const balance = await getSolanaBalance(walletAddress);
      return balance;
    } catch (error) {
      logger.error('Error fetching Solana balance:', error);
      return null;
    }
  }

  async executeSwap(params: { fromToken: string; toToken: string; amount: number }) {
    try {
      const result = await executeSwap(params.fromToken, params.toToken, params.amount, params.toToken);
      return result;
    } catch (error) {
      logger.error('Error executing swap:', error);
      return null;
    }
  }

  async fetchTokenInfo(tokenAddress: string) {
    try {
      const info = await fetchTokenInfo(tokenAddress);
      return info;
    } catch (error) {
      logger.error('Error fetching token info:', error);
      return null;
    }
  }

  async getTokenInfo(tokenAddress: string) {
    try {
      const info = await getTokenInfo(tokenAddress);
      return info;
    } catch (error) {
      logger.error('Error getting token info:', error);
      return null;
    }
  }

  async swapSolToToken(params: { toToken: string; amount: number }) {
    try {
      const result = await swapSolToToken(params.amount, params.toToken);
      return result;
    } catch (error) {
      logger.error('Error swapping SOL to token:', error);
      return null;
    }
  }

  async getWalletBalance(): Promise<number | null> {
    try {
      const balance = await agentWallet.getBalance();
      return balance.balance;
    } catch (error) {
      logger.error('Error fetching wallet balance:', error);
      return null;
    }
  }

  async sendSolToAddress(recipient: string, amount: number): Promise<string | null> {
    try {
      const result = await agentWallet.sendSOL(recipient, amount);
      return result.signature;
    } catch (error) {
      logger.error('Error sending SOL:', error);
      return null;
    }
  }

  async getWalletAddress(): Promise<string | null> {
    try {
      const address = await agentWallet.getAddress();
      return address;
    } catch (error) {
      logger.error('Error fetching wallet address:', error);
      return null;
    }
  }

  async signAndSendTransaction(transaction: VersionedTransaction): Promise<string | null> {
    try {
      const signature = await agentWallet.signAndSendTransaction(transaction);
      return signature;
    } catch (error) {
      logger.error('Error signing and sending transaction:', error);
      return null;
    }
  }

  async fetchAndAnalyzePrice(tokenAddress: string): Promise<string> {
    try {
      const priceData = parseFloat(await fetchPrice(new PublicKey(tokenAddress)));
      const analysis = await this.analyzeMarket(tokenAddress);

      return `Price for ${tokenAddress}: $${priceData}\n` +
             //`24h Change: ${analysis.metrics.priceChange24h}%\n` +
             `Market Analysis: ${analysis.summary}\n` +
             `Sentiment: ${this.formatSentiment(analysis.confidence)}`;
    } catch (error) {
      logger.error('Error fetching and analyzing price:', error);
      return 'Error fetching and analyzing price. Please try again.';
    }
  }
}

// Export singleton instance with streaming support
export const aiService = new AIService({
  groqApiKey: CONFIG.AI.GROQ.API_KEY,
  defaultModel: CONFIG.AI.GROQ.MODEL,
  maxTokens: CONFIG.AI.GROQ.MAX_TOKENS,
  temperature: CONFIG.AI.GROQ.DEFAULT_TEMPERATURE
});

export default aiService;