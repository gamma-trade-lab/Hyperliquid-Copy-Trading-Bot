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
}

export interface MarketAnalysis {
  shouldTrade: boolean;
  confidence: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  metrics: MarketData;
}
