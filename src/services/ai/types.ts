export interface MarketData {
    price: number;
    volume24h: number;
    marketCap: number;
    priceChange24h: number;
    topHolders: Array<{
      address: string;
      balance: number;
    }>;
  }
  
  export interface CommunityMetrics {
    totalFollowers: number;
    activeUsers24h: number;
    sentimentScore: number;
    topInfluencers: string[];
  }