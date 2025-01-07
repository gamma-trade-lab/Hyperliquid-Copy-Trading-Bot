declare module '@fleek-platform/sdk' {
  export interface FleekSdk {
    ipfs(): {
      add(params: { data: string | Buffer }): Promise<{ hash: string }>;
      get(hash: string): Promise<Buffer>;
    };
  }

  export function createFleekSdk(config: { apiKey: string }): FleekSdk;
}
