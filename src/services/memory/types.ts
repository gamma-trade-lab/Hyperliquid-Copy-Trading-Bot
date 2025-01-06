export interface TimeRange {
  start: number;
  end: number;
}

export interface Memory {
  id: string;
  content: string;
  category: string;
  timestamp: number;
  metadata?: Record<string, any>;
  embedding?: number[];
}

export interface MemorySearchOptions {
  timeRange?: TimeRange;
  category?: string;
  limit?: number;
  metadata?: Record<string, any>;
}

export interface ClusteringResult {
  clusters: Memory[][];
  noise: Memory[];
}

export interface MemoryServiceConfig {
  namespace: string;
  collectionPrefix?: string;
  chromaHost?: string;
  chromaPort?: number;
}
