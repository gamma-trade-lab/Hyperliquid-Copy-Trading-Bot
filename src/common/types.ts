import {
  Plugin,
  Action,
  Content,
  ActionExample,
  Handler,
  Validator,
} from "@ai16z/eliza";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  score?: number;
  source: "tavily" | "exa";
  metadata?: Record<string, unknown>;
}

export interface SearchOptions {
  maxResults?: number;
  searchType?: string;
  filters?: Record<string, unknown>;
}

export interface SearchProvider {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}

export interface SearchPluginConfig {
  apiKey: string;
  maxResults?: number;
  searchType?: string;
  filters?: Record<string, unknown>;
}

export interface SearchAction extends Action {
  name: string;
  description: string;
  examples: ActionExample[][];
  similes: string[];
  handler: Handler;
  validate: Validator;
}

export interface SearchPlugin extends Plugin {
  name: string;
  description: string;
  actions: SearchAction[];
  config: SearchPluginConfig;
}
