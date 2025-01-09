export interface JupiterPriceResponse {
  data: {
    [tokenMint: string]: {
      id: string;
      mintSymbol: string;
      vsToken: string;
      vsTokenSymbol: string;
      price: number;
      confidence: number;
    };
  };
}

export interface JupiterPrice {
  price: number;
  confidence: number;
}

export interface HeliusResponse {
  result: HeliusTransaction[];
}

export interface TokenPrice {
  price: number;
  confidence: number;
  timestamp: number;
}

export interface MarketDepth {
  bids: {
    price: number;
    size: number;
  }[];
  asks: {
    price: number;
    size: number;
  }[];
}

export interface PriceImpact {
  buyImpact: number;
  sellImpact: number;
  timestamp: number;
}

export interface TokenMetrics {
  price: TokenPrice;
  depth?: MarketDepth;
  impact?: PriceImpact;
  volume24h?: number;
  lastUpdate: number;
}

export interface TransactionMetrics {
  totalVolume: number;
  uniqueWallets: Set<string>;
  transactionCount: number;
  lastUpdate: number;
}

// Add with other interfaces
export interface HeliusTransaction {
  signature: string;
  slot: number;
  type: string;
  timestamp: number;
  fee: number;
  status: 'success' | 'failed';
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  tokenTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    fromTokenAccount: string;
    toTokenAccount: string;
    tokenAmount: number;
    mint: string;
  }>;
}