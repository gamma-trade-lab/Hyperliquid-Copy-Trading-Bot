interface CacheOptions {
  ttl: number;  // Time to live in seconds
  maxSize?: number;  // Maximum number of items
  updateInterval?: number;  // Update interval in seconds
}

interface CacheEntry<T> {
  value: T;
  expires: number;
  lastAccessed: number;
}

export class Cache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private readonly options: Required<CacheOptions>;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(options: CacheOptions) {
    this.options = {
      maxSize: 1000,
      updateInterval: 60,
      ...options
    };

    if (this.options.updateInterval > 0) {
      this.startCleanup();
    }
  }

  set(key: string, value: T): void {
    // Ensure we don't exceed maxSize
    if (this.cache.size >= this.options.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      expires: Date.now() + this.options.ttl * 1000,
      lastAccessed: Date.now()
    });
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }

    // Update last accessed time
    entry.lastAccessed = Date.now();
    return entry.value;
  }

  async getOrSet(
    key: string,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await fetchFn();
    this.set(key, value);
    return value;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  values(): T[] {
    return Array.from(this.cache.values())
      .filter(entry => Date.now() <= entry.expires)
      .map(entry => entry.value);
  }

  entries(): [string, T][] {
    return Array.from(this.cache.entries())
      .filter(([_, entry]) => Date.now() <= entry.expires)
      .map(([key, entry]) => [key, entry.value]);
  }

  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      this.options.updateInterval * 1000
    );
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Create cache instances for different types of data
export const tokenCache = new Cache<any>({
  ttl: 300,  // 5 minutes
  maxSize: 1000
});

export const priceCache = new Cache<any>({
  ttl: 5,    // 5 seconds
  maxSize: 1000
});

export const quoteCache = new Cache<any>({
  ttl: 3,    // 3 seconds
  maxSize: 100
});

export const marketCache = new Cache<any>({
  ttl: 60,   // 1 minute
  maxSize: 500
});

// Cache decorator
export function cached(
  cache: Cache<any>,
  keyFn?: (...args: any[]) => string
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const key = keyFn 
        ? keyFn(...args)
        : `${propertyKey}:${JSON.stringify(args)}`;

      return await cache.getOrSet(key, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
} 