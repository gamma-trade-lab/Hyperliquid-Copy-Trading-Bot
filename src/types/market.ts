export interface PriceData {
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface VolatilityMetrics {
  currentVolatility: number;
  averageVolatility: number;
  adjustmentFactor: number;
}

export interface TokenMetrics {
  price: number;
  volume24h: number;
  priceChange24h: number;
  volatility: number;
}

export interface OnChainData {
  recentSwaps: number;
  recentTransfers: number;
  totalTransactions: number;
}

export interface MarketData {
  price: number;
  volume24h: number;
  marketCap: number;
  priceChange24h: number;  // Required for tweet generation
  topHolders: Array<{      // Required for tweet generation
    address: string;
    balance: number;
  }>;
  volatility?: VolatilityMetrics;
  onChainData?: OnChainData;  // Optional field for Helius transaction data
}

export interface MarketAnalysis {
  shouldTrade: boolean;
  confidence: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  metrics: MarketData;
}
