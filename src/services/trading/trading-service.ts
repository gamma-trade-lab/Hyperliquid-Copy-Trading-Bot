import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { z } from 'zod';
import { cache } from 'react';

// Constants
export const TOKENS = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  SOL: 'So11111111111111111111111111111111111111112',
  IBRLC: '7wxyV4i7iZvayjGN9bXkgJMRnPcnwWnQTPtd9KWjN3vM'
} as const;

// Validation Schemas
const tokenPriceSchema = z.object({
  id: z.string(),
  type: z.string(),
  price: z.string()
});

const swapQuoteSchema = z.object({
  inputMint: z.string(),
  outputMint: z.string(),
  inAmount: z.string(),
  outAmount: z.string(),
  priceImpactPct: z.string(),
  marketInfos: z.array(z.any()),
  swapMode: z.string(),
  otherAmountThreshold: z.string(),
  routePlan: z.array(z.object({
    swapInfo: z.object({
      ammKey: z.string(),
      label: z.string(),
      inputMint: z.string(),
      outputMint: z.string(),
      inAmount: z.string(),
      outAmount: z.string(),
      feeAmount: z.string(),
      feeMint: z.string()
    }),
    percent: z.number()
  }))
});

export interface TradeAnalysis {
  priceImpact: number;
  expectedOutput: number;
  minimumOutput: number;
  route: string[];
  fees: {
    network: number;
    protocol: number;
    total: number;
  };
  marketDepth: {
    inputDepth: number;
    outputDepth: number;
    ratio: number;
  };
}

export class TradingService {
  private readonly heliusUrl: string;
  private readonly connection: Connection;
  
  constructor() {
    const apiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
    if (!apiKey) {
      throw new Error('HELIUS_API_KEY is not configured');
    }
    this.heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
    this.connection = new Connection(this.heliusUrl);
  }

  // Token Information
  @cache
  async getTokenInfo(mintAddress: string) {
    try {
      const response = await fetch(`https://tokens.jup.ag/token/${mintAddress}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching token info:', error);
      throw error;
    }
  }

  // Price Information
  @cache
  async getTokenPrice(tokenAddress: string): Promise<z.infer<typeof tokenPriceSchema> | null> {
    try {
      const response = await fetch(
        `https://api.jup.ag/price/v2?ids=${tokenAddress}&showExtraInfo=true`,
        { next: { revalidate: 5 } }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch price data');
      }

      const data = await response.json();
      const price = data.data[tokenAddress];
      return price ? tokenPriceSchema.parse(price) : null;
    } catch (error) {
      console.error('Error fetching token price:', error);
      return null;
    }
  }

  // Market Analysis
  async analyzeMarket(mintAddress: string) {
    const [tokenInfo, holders] = await Promise.all([
      this.getTokenInfo(mintAddress),
      this.getTokenHolders(mintAddress)
    ]);

    return {
      tokenInfo,
      holders,
      marketMetrics: {
        concentration: this.calculateHolderConcentration(holders),
        activity: await this.getMarketActivity(mintAddress),
        depth: await this.getMarketDepth(mintAddress)
      }
    };
  }

  // Trade Analysis
  async analyzeTradeRoute(
    inputMint: string,
    outputMint: string,
    amount: number
  ): Promise<TradeAnalysis> {
    const quote = await this.getSwapQuote(amount, inputMint, outputMint);
    if (!quote) throw new Error('Failed to get swap quote');

    const validatedQuote = swapQuoteSchema.parse(quote);
    const route = validatedQuote.routePlan.map(r => r.swapInfo.label);
    
    const priceImpact = parseFloat(validatedQuote.priceImpactPct);
    const expectedOutput = parseInt(validatedQuote.outAmount) / this.getTokenDecimals(outputMint);
    const slippage = 0.005; // 0.5%
    const minimumOutput = expectedOutput * (1 - slippage);

    // Calculate fees
    const fees = {
      network: validatedQuote.routePlan.reduce((acc, r) => acc + parseInt(r.swapInfo.feeAmount), 0) / 1e9,
      protocol: 0, // Jupiter protocol fees if any
      total: 0
    };
    fees.total = fees.network + fees.protocol;

    // Get market depth
    const marketDepth = await this.getMarketDepth(outputMint);

    return {
      priceImpact,
      expectedOutput,
      minimumOutput,
      route,
      fees,
      marketDepth
    };
  }

  // Swap Execution
  async executeSwap(
    inputMint: string,
    outputMint: string,
    amount: number,
    wallet: any // Replace with your wallet type
  ) {
    // Validate inputs
    if (amount <= 0) throw new Error('Invalid amount');
    if (!wallet) throw new Error('Wallet not connected');

    // Get quote
    const quote = await this.getSwapQuote(amount, inputMint, outputMint);
    if (!quote) throw new Error('Failed to get swap quote');

    // Prepare transaction
    const tx = await this.prepareSwapTransaction(quote, wallet.publicKey);
    
    // Sign and send
    try {
      const signature = await wallet.signAndSendTransaction(tx);
      return { status: 'success', signature, quote };
    } catch (error) {
      console.error('Swap execution error:', error);
      return { 
        status: 'error',
        message: error instanceof Error ? error.message : 'transaction_failed',
        quote 
      };
    }
  }

  // Private helper methods
  private getTokenDecimals(mint: string): number {
    switch (mint) {
      case TOKENS.USDC: return 1e6;  // 6 decimals
      case TOKENS.IBRLC: return 1e9; // 9 decimals
      default: return 1e9;           // Default 9 decimals (SOL)
    }
  }

  private async getSwapQuote(
    amount: number,
    inputMint: string = TOKENS.SOL,
    outputMint: string = TOKENS.USDC
  ) {
    const inputAmount = (amount * this.getTokenDecimals(inputMint)).toString();
    const slippageBps = outputMint === TOKENS.IBRLC ? 1000 : 50;

    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: inputAmount,
      slippageBps: slippageBps.toString(),
      onlyDirectRoutes: (outputMint === TOKENS.IBRLC).toString(),
      asLegacyTransaction: 'false'
    });

    try {
      const response = await fetch(`https://quote-api.jup.ag/v6/quote?${params}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Error getting swap quote:', error);
      return null;
    }
  }

  private async prepareSwapTransaction(quote: any, userPublicKey: PublicKey) {
    const response = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: userPublicKey.toString(),
        wrapUnwrapSOL: true,
        computeUnitPriceMicroLamports: 'auto',
        asLegacyTransaction: false
      })
    });

    if (!response.ok) {
      throw new Error(`Swap preparation failed: ${response.statusText}`);
    }

    const { swapTransaction } = await response.json();
    const transactionBuffer = Buffer.from(swapTransaction, 'base64');
    return VersionedTransaction.deserialize(transactionBuffer);
  }

  private async getMarketDepth(mintAddress: string) {
    // Implement market depth calculation using Jupiter API
    return {
      inputDepth: 0,
      outputDepth: 0,
      ratio: 0
    };
  }

  private async getMarketActivity(mintAddress: string) {
    // Implement market activity tracking
    return {
      volume24h: 0,
      trades24h: 0,
      uniqueTraders24h: 0
    };
  }

  private calculateHolderConcentration(holders: any[]) {
    // Implement holder concentration calculation
    return {
      gini: 0,
      top10Percentage: 0,
      uniqueHolders: holders.length
    };
  }

  private async getTokenHolders(mintAddress: string) {
    // Implement holder fetching using Helius API
    return [];
  }
}

// Export singleton instance
export const tradingService = new TradingService(); 