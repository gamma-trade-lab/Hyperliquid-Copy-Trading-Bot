export interface MarketData {
  price: number;
  volume24h: number;
  marketCap: number;
  priceChange24h: number;
  topHolders: string[];
}

export interface MarketAnalysis {
  shouldTrade: boolean;
  confidence: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  metrics: MarketData;
}
