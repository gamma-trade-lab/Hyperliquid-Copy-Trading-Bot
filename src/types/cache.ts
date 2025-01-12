export interface ICacheManager {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: any, options?: { expires?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  flushAll(): Promise<void>;
}