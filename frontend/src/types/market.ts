import { TokenPrice } from "@/utils/coingecko";

// types/market.ts
export type TimeFrame = '24h' | '7d' | '30d' | '1y';
export type ChartType = 'line' | 'area' | 'bar';
export type MetricType = 'price' | 'volume' | 'marketCap';

export interface ChartData {
  timestamp: number;
  price: number;
  volume: number;
  marketCap: number;
}

export interface ChartConfig {
  type: ChartType;
  timeframe: TimeFrame;
  metric: MetricType;
  data: ChartData[];
}

export interface AnalysisProps {
  updateChartConfig: (updates: Partial<ChartConfig>) => void;
  selectedToken: string;
  onTokenSelect: (token: string) => void;
  chartConfig: ChartConfig;
}

export interface ChartProps {
  chartConfig: ChartConfig;
  isLoading?: boolean;
}

export interface MarketDataProps {
  token: string;
  metric: MetricType;
  onPriceUpdate?: (price: TokenPrice) => void;
  onError?: (error: Error) => void;
  updateInterval?: number;
}