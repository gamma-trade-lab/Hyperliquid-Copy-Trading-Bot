declare module 'agentmemory' {
  export interface Memory {
    id: string;
    content: string;
    category: string;
    timestamp: number;
    metadata?: Record<string, any>;
    embedding?: number[];
  }

  export interface TimeRange {
    start: number;
    end: number;
  }

  export interface SearchOptions {
    timeRange?: TimeRange;
    category?: string;
    limit?: number;
    metadata?: Record<string, any>;
  }

  export interface ClusteringResult {
    clusters: Memory[][];
    noise: Memory[];
  }
}
