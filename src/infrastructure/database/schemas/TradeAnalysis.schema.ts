import { Schema, model, Document } from 'mongoose';

export interface ITradeAnalysis extends Document {
  signature: string;
  timestamp: Date;
  inputToken: {
    mint: string;
    symbol: string;
    amount: string;
    usdValue: number;
  };
  outputToken: {
    mint: string;
    symbol: string;
    amount: string;
    usdValue: number;
  };
  priceImpact: number;
  slippage: number;
  route: {
    marketInfos: Array<{
      amm: string;
      label: string;
      inAmount: string;
      outAmount: string;
      priceImpact: number;
    }>;
  };
  aiAnalysis: {
    confidence: number;
    recommendation: 'BUY' | 'SELL' | 'HOLD';
    reasoning: string;
    predictedPriceImpact: number;
    riskScore: number;
  };
  metadata: {
    heliusAiScore?: number;
    marketConditions?: string;
    volatilityMetrics?: {
      hourly: number;
      daily: number;
      weekly: number;
    };
    relatedTransactions?: string[];
  };
  agentId: string;
  status: 'ANALYZED' | 'PENDING_EXECUTION' | 'EXECUTED' | 'FAILED';
  executionResult?: {
    success: boolean;
    signature?: string;
    error?: string;
    gasUsed?: number;
    actualSlippage?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const tradeAnalysisSchema = new Schema<ITradeAnalysis>({
  signature: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  inputToken: {
    mint: String,
    symbol: String,
    amount: String,
    usdValue: Number
  },
  outputToken: {
    mint: String,
    symbol: String,
    amount: String,
    usdValue: Number
  },
  priceImpact: Number,
  slippage: Number,
  route: {
    marketInfos: [{
      amm: String,
      label: String,
      inAmount: String,
      outAmount: String,
      priceImpact: Number
    }]
  },
  aiAnalysis: {
    confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    recommendation: {
      type: String,
      enum: ['BUY', 'SELL', 'HOLD']
    },
    reasoning: String,
    predictedPriceImpact: Number,
    riskScore: {
      type: Number,
      min: 0,
      max: 100
    }
  },
  metadata: {
    heliusAiScore: Number,
    marketConditions: String,
    volatilityMetrics: {
      hourly: Number,
      daily: Number,
      weekly: Number
    },
    relatedTransactions: [String]
  },
  agentId: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['ANALYZED', 'PENDING_EXECUTION', 'EXECUTED', 'FAILED'],
    default: 'ANALYZED'
  },
  executionResult: {
    success: Boolean,
    signature: String,
    error: String,
    gasUsed: Number,
    actualSlippage: Number
  }
}, {
  timestamps: true
});

// Create indexes for common queries
tradeAnalysisSchema.index({ 'inputToken.mint': 1 });
tradeAnalysisSchema.index({ 'outputToken.mint': 1 });
tradeAnalysisSchema.index({ 'aiAnalysis.recommendation': 1 });
tradeAnalysisSchema.index({ status: 1, createdAt: -1 });

export const TradeAnalysis = model<ITradeAnalysis>('TradeAnalysis', tradeAnalysisSchema); 