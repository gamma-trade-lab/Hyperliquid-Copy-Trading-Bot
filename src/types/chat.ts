// types/chat.ts
export type Mode = 'chat' | 'auto' | 'market';

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: any;
}

export interface Command {
  name: string;
  description: string;
  execute: (args: string[]) => Promise<CommandResult>; // Ensure execute returns Promise<CommandResult>
}

export interface ModeConfig {
  welcomeMessage: string; // Ensure welcomeMessage is always a string
  commands: Command[]; // Ensure commands is always a Command[]
  onEnter?: () => Promise<void>;
  onExit?: () => Promise<void>;
}

// src/services/chat/types.ts
import { MarketData, MarketAnalysis as GlobalMarketAnalysis } from '@/types/market';

export interface ServiceMarketAnalysis extends Omit<GlobalMarketAnalysis, 'metrics'> {
  metrics: Required<MarketData>; // Ensure metrics is required
}

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: any;
}