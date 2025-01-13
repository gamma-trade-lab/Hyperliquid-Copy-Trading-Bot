export class HttpError extends Error {
    status;
    statusText;
    url;
    constructor(status, statusText, url, message) {
        super(message || `HTTP Error ${status}: ${statusText} at ${url}`);
        this.status = status;
        this.statusText = statusText;
        this.url = url;
        this.name = 'HttpError';
    }
}
export class HttpClient {
    static instance;
    rateLimiters = new Map();
    constructor() { }
    static getInstance() {
        if (!HttpClient.instance) {
            HttpClient.instance = new HttpClient();
        }
        return HttpClient.instance;
    }
    async throttle(baseUrl, rateLimit) {
        if (!rateLimit)
            return;
        const limiter = this.rateLimiters.get(baseUrl) || { lastRequest: 0 };
        const now = Date.now();
        const timeSinceLastRequest = now - limiter.lastRequest;
        if (timeSinceLastRequest < rateLimit.minInterval) {
            await new Promise(resolve => setTimeout(resolve, rateLimit.minInterval - timeSinceLastRequest));
        }
        limiter.lastRequest = Date.now();
        this.rateLimiters.set(baseUrl, limiter);
    }
    async fetchWithTimeout(url, options) {
        const { timeout = 10000, ...fetchOptions } = options;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, {
                ...fetchOptions,
                signal: controller.signal
            });
            return response;
        }
        finally {
            clearTimeout(id);
        }
    }
    async request(url, options = {}) {
        const { rateLimit, retries = 3, timeout, ...fetchOptions } = options;
        const baseUrl = new URL(url).origin;
        await this.throttle(baseUrl, rateLimit);
        let lastError;
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const response = await this.fetchWithTimeout(url, {
                    ...fetchOptions,
                    timeout
                });
                if (!response.ok) {
                    throw new HttpError(response.status, response.statusText, url);
                }
                return await response.json();
            }
            catch (error) {
                lastError = error;
                // Don't retry on 4xx errors
                if (error instanceof HttpError && error.status >= 400 && error.status < 500) {
                    throw error;
                }
                // Wait before retrying
                if (attempt < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
            }
        }
        throw lastError;
    }
    async post(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            body: JSON.stringify(data)
        });
    }
    async get(url, options = {}) {
        return this.request(url, {
            ...options,
            method: 'GET'
        });
    }
}
// Export singleton instance
export const httpClient = HttpClient.getInstance();
// RPC client for JSON-RPC APIs
export class RpcClient {
    baseUrl;
    options;
    constructor(baseUrl, options = {}) {
        this.baseUrl = baseUrl;
        this.options = options;
    }
    async call(method, params) {
        const response = await httpClient.post(this.baseUrl, {
            jsonrpc: '2.0',
            id: Math.random().toString(36).substring(7),
            method,
            params
        }, this.options);
        if (response.error) {
            throw new Error(`RPC Error: ${response.error.message}`);
        }
        return response.result;
    }
}
