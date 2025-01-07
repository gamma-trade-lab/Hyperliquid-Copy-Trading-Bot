export interface Transaction {
  amount?: number;
  sender?: string;
  receiver?: string;
  timestamp: string;
  status: 'Success' | 'Failed';
  type: string;
  fee?: number;
  tokenTransfer?: {
    amount: number;
    symbol: string;
    tokenAddress?: string;
  };
}

export interface TransactionMetrics {
  volume: {
    total: number;
    inflow: number;
    outflow: number;
  };
  activity: {
    totalTx: number;
    uniqueAddresses: number;
    successRate: number;
  };
  fees: {
    total: number;
    average: number;
    max: number;
  };
  timing: {
    averageConfirmation: number;
    failureRate: number;
    peakHours: number[];
  };
}
