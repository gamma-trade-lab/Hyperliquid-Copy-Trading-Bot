interface RateLimitConfig {
  requestsPerSecond: number;
  minInterval: number;
}

interface RequestOptions extends RequestInit {
  rateLimit?: RateLimitConfig;
  retries?: number;
  timeout?: number;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly url: string,
    message?: string
  ) {
    super(message || `HTTP Error ${status}: ${statusText} at ${url}`);
    this.name = 'HttpError';
  }
}

export class HttpClient {
  private static instance: HttpClient;
  private rateLimiters: Map<string, { lastRequest: number }> = new Map();

  private constructor() {}

  static getInstance(): HttpClient {
    if (!HttpClient.instance) {
      HttpClient.instance = new HttpClient();
    }
    return HttpClient.instance;
  }

  private async throttle(baseUrl: string, rateLimit?: RateLimitConfig) {
    if (!rateLimit) return;

    const limiter = this.rateLimiters.get(baseUrl) || { lastRequest: 0 };
    const now = Date.now();
    const timeSinceLastRequest = now - limiter.lastRequest;

    if (timeSinceLastRequest < rateLimit.minInterval) {
      await new Promise(resolve => 
        setTimeout(resolve, rateLimit.minInterval - timeSinceLastRequest)
      );
    }

    limiter.lastRequest = Date.now();
    this.rateLimiters.set(baseUrl, limiter);
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestOptions
  ): Promise<Response> {
    const { timeout = 10000, ...fetchOptions } = options;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });
      return response;
    } finally {
      clearTimeout(id);
    }
  }

  async request<T>(
    url: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      rateLimit,
      retries = 3,
      timeout,
      ...fetchOptions
    } = options;

    const baseUrl = new URL(url).origin;
    await this.throttle(baseUrl, rateLimit);

    let lastError: Error | undefined;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, {
          ...fetchOptions,
          timeout
        });

        if (!response.ok) {
          throw new HttpError(
            response.status,
            response.statusText,
            url
          );
        }

        return await response.json();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on 4xx errors
        if (error instanceof HttpError && error.status >= 400 && error.status < 500) {
          throw error;
        }

        // Wait before retrying
        if (attempt < retries - 1) {
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    throw lastError;
  }

  async post<T>(
    url: string,
    data: any,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: JSON.stringify(data)
    });
  }

  async get<T>(
    url: string,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'GET'
    });
  }
}

// Export singleton instance
export const httpClient = HttpClient.getInstance();

// RPC client for JSON-RPC APIs
export class RpcClient {
  constructor(
    private readonly baseUrl: string,
    private readonly options: RequestOptions = {}
  ) {}

  async call<T>(
    method: string,
    params: any[]
  ): Promise<T> {
    const response = await httpClient.post<{
      result: T;
      error?: {
        code: number;
        message: string;
      };
    }>(
      this.baseUrl,
      {
        jsonrpc: '2.0',
        id: Math.random().toString(36).substring(7),
        method,
        params
      },
      this.options
    );

    if (response.error) {
      throw new Error(`RPC Error: ${response.error.message}`);
    }

    return response.result;
  }
} 