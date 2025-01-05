export interface MarketData {
  price: number;
  volume24h: number;
  marketCap: number;
  priceChange24h: number;  // Required for tweet generation
  topHolders: Array<{      // Required for tweet generation
    address: string;
    balance: number;
  }>;
}

export interface MarketAnalysis {
  shouldTrade: boolean;
  confidence: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  metrics: MarketData;
}
