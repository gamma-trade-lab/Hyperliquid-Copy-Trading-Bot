// types/portfolio.ts

export interface Asset {
    symbol: string;
    name: string;
    amount: number;
    amountLamports: number;
    priceUSD: string;
    valueUSD: number;
    decimals: number;
    address: string;
  }
  
  export interface Portfolio {
    totalValueUSD: number;
    assets: Asset[];
    percentages: Allocation;
  }
  
  export interface Allocation {
    [key: string]: string; // e.g., { "WBTC": "30%", "wSOL": "50%", "USDC": "20%" }
  }
  
  export interface Trade {
    from: string;
    to: string;
    percentage: number;
  }
  
  export interface Log {
    time: string;
    total: number;
    assets: {
      symbol: string;
      price: string;
      value: number;
      amount: number;
    }[];
    percentages: Allocation;
  }
  
  export interface RebalanceResult {
    status: string;
    trades?: Trade[];
    transactions?: any[];
    message?: string;
  }
  
  export type PortfolioAction = 
    | { type: 'UPDATE_PORTFOLIO'; payload: Portfolio }
    | { type: 'SET_TARGET_ALLOCATION'; payload: Allocation }
    | { type: 'START_REBALANCE' }
    | { type: 'COMPLETE_REBALANCE'; payload: RebalanceResult }
    | { type: 'SET_ERROR'; payload: string };