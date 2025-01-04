import { elizaLogger } from "@ai16z/eliza";

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const refillAmount = (timePassed * this.refillRate) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + refillAmount);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();
    
    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) * (1000 / this.refillRate);
      elizaLogger.warn(`Rate limit enforced, waiting ${Math.round(waitTime)}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.refill();
    }
    
    this.tokens -= 1;
  }

  // Add release method to return a token to the bucket
  release(): void {
    this.tokens = Math.min(this.maxTokens, this.tokens + 1);
  }

  // Get current token count (useful for debugging)
  getTokenCount(): number {
    this.refill();
    return this.tokens;
  }
}
