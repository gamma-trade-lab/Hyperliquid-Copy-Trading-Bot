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

export interface HeliusTransaction {
  signature: string;
  type: string;
  timestamp: number;
  slot: number;
  description?: string;
  source?: string;
  fee?: number;
  nativeTransfers?: {
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }[];
  tokenTransfers?: {
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    mint: string;
  }[];
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
