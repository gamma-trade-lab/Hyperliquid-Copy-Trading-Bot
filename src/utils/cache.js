export class Cache {
    cache = new Map();
    options;
    cleanupInterval;
    constructor(options) {
        this.options = {
            maxSize: 1000,
            updateInterval: 60,
            ...options
        };
        if (this.options.updateInterval > 0) {
            this.startCleanup();
        }
    }
    set(key, value) {
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
    get(key) {
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
    async getOrSet(key, fetchFn) {
        const cached = this.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const value = await fetchFn();
        this.set(key, value);
        return value;
    }
    has(key) {
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
    delete(key) {
        this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
    }
    size() {
        return this.cache.size;
    }
    keys() {
        return Array.from(this.cache.keys());
    }
    values() {
        return Array.from(this.cache.values())
            .filter(entry => Date.now() <= entry.expires)
            .map(entry => entry.value);
    }
    entries() {
        return Array.from(this.cache.entries())
            .filter(([_, entry]) => Date.now() <= entry.expires)
            .map(([key, entry]) => [key, entry.value]);
    }
    evictOldest() {
        let oldestKey;
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
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expires) {
                this.cache.delete(key);
            }
        }
    }
    startCleanup() {
        this.cleanupInterval = setInterval(() => this.cleanup(), this.options.updateInterval * 1000);
    }
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}
// Create cache instances for different types of data
export const tokenCache = new Cache({
    ttl: 300, // 5 minutes
    maxSize: 1000
});
export const priceCache = new Cache({
    ttl: 5, // 5 seconds
    maxSize: 1000
});
export const quoteCache = new Cache({
    ttl: 3, // 3 seconds
    maxSize: 100
});
export const marketCache = new Cache({
    ttl: 60, // 1 minute
    maxSize: 500
});
// Cache decorator
export function cached(cache, keyFn) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const key = keyFn
                ? keyFn(...args)
                : `${propertyKey}:${JSON.stringify(args)}`;
            return await cache.getOrSet(key, () => originalMethod.apply(this, args));
        };
        return descriptor;
    };
}
