export interface PriceData {
  price: any;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}
export interface MarketData {
  price: number;
  volume24h: number;
  priceChange24h: number;
  marketCap: number;
  lastUpdate: number;
  tokenAddress: string;
  topHolders: Array<{ address: string; balance: number }>;
  volatility: {
    currentVolatility: number;
    averageVolatility: number;
    adjustmentFactor: number;
  };
  holders: {
    total: number;
    top: Array<{ address: string; balance: number; percentage: number }>;
  };
  onChainActivity: { // Ensure onChainActivity is always defined
    transactions: number;
    swaps: number;
    uniqueTraders: number;
  };
  onChainData?: { // Add onChainData property
    recentSwaps: number;
    recentTransfers: number;
    totalTransactions: number;
  };
  confidence?: 'high' | 'medium' | 'low';
}

export interface JupiterSwap {
  data: {
    author_id: string;
    transaction_id: string;
    timestamp: number;
  };
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

export interface MarketAnalysis {
  shouldTrade: boolean;
  confidence: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  metrics: MarketData;
}

export interface MarketUpdateData {
  lastUpdate: number;
  symbol: any;
  tokenAddress(tokenAddress: any): unknown;
  price: number;
  volume24h: number;
  priceChange24h: number;
  marketCap: number;
  topHolders: string[];
}

export interface MarketAnalysis {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  metrics: MarketData;
  recommendations?: string[];
  risk?: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    shouldUpdate: boolean;
  };
}

export interface MarketMetrics {
  price: number;
  volume24h: number;
  priceChange24h: number;
  marketCap: number;
  confidenceLevel: 'high' | 'medium' | 'low';
}

export interface JupiterPriceServiceConfig {
  redis: {
    host?: string;
    port?: number;
    password?: string;
    keyPrefix?: string;
    enableCircuitBreaker?: boolean;
  };
  rpcConnection?: {
    url: string;
    walletPublicKey?: string;
  };
  rateLimitConfig?: {
    requestsPerMinute?: number;
    windowMs?: number;
  };
}