import { Mode } from '@/types/chat';

export interface AutoModeConfig {
  postInterval?: number;
  marketCheckInterval?: number;
  tokens?: string[];
  minimumPriceChange?: number;
  minimumVolumeChange?: number;
}

export interface MarketUpdateData {
  symbol: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  lastUpdate: number;
}

export interface MarketAlertCriteria {
  priceChangeThreshold: number;
  volumeChangeThreshold: number;
  timeframe: number;
}