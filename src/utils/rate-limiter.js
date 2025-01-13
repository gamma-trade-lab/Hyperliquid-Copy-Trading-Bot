import { elizaLogger } from "@ai16z/eliza";
export class RateLimiter {
    tokens;
    lastRefill;
    maxTokens;
    refillRate;
    constructor(maxTokens, refillRate) {
        this.maxTokens = maxTokens;
        this.tokens = maxTokens;
        this.refillRate = refillRate;
        this.lastRefill = Date.now();
    }
    refill() {
        const now = Date.now();
        const timePassed = now - this.lastRefill;
        const refillAmount = (timePassed * this.refillRate) / 1000;
        this.tokens = Math.min(this.maxTokens, this.tokens + refillAmount);
        this.lastRefill = now;
    }
    async acquire() {
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
    release() {
        this.tokens = Math.min(this.maxTokens, this.tokens + 1);
    }
    // Get current token count (useful for debugging)
    getTokenCount() {
        this.refill();
        return this.tokens;
    }
}
