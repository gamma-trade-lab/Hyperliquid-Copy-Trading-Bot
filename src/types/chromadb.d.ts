declare module 'chromadb' {
  export interface Collection {
    add(params: { documents: string[]; metadatas: Record<string, any>[]; ids: string[] }): Promise<void>;
    query(params: { queryTexts: string[]; nResults?: number; where?: Record<string, any> }): Promise<{
      documents: string[][];
      metadatas: Record<string, any>[][];
      distances: number[][];
      ids: string[][];
    }>;
    delete(params: { ids: string[] }): Promise<void>;
    get(params: { where?: Record<string, any>; ids?: string[]; nResults?: number }): Promise<{
      documents: string[];
      metadatas: Record<string, any>[];
      ids: string[];
    }>;
  }

  export class ChromaClient {
    constructor(config?: { path?: string });
    createCollection(name: string): Promise<Collection>;
    getCollection(name: string): Promise<Collection>;
    getOrCreateCollection(params: { name: string }): Promise<Collection>;
    listCollections(): Promise<{ name: string }[]>;
    deleteCollection(name: string): Promise<void>;
  }
}
