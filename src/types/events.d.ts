// src/types/events.d.ts

export interface MessageEvent {
    platform: 'discord' | 'twitter';
    content: string;
    author: string;
    timestamp: Date;
    raw?: any;
  }
  
  export interface TransactionEvent {
    signature: string;
    type: 'swap' | 'transfer' | 'mint' | 'other';
    amount?: number;
    token?: string;
    sender?: string;
    receiver?: string;
    timestamp: Date;
    raw?: any;
  }
  
  export interface TransactionAnalysis {
    type: string;
    significance: number;
    impact: 'high' | 'medium' | 'low';
    summary: string;
    recommendations?: string[];
    tags: string[];
  }
  
  export interface ServiceEventMap {
    message: MessageEvent;
    transaction: TransactionEvent;
    error: Error;
  }
  
  export type ServiceEventType = keyof ServiceEventMap;
  export type ServiceEventHandler<T extends ServiceEventType> = (event: ServiceEventMap[T]) => void | Promise<void>;