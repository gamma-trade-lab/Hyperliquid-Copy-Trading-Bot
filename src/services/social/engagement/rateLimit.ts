// src/services/social/engagement/rateLimit.ts

import { Platform } from '../../../personality/traits/responsePatterns';
import { EventEmitter } from 'events';

interface RateLimit {
  platform: Platform;
  maxRequests: number;
  windowMs: number;
  current: number;
  resetTime: number;
}

interface RequestTracker {
  timestamp: number;
  endpoint: string;
  successful: boolean;
}

export class RateLimitManager extends EventEmitter {
  private limits: Map<Platform, RateLimit>;
  private requestHistory: Map<Platform, RequestTracker[]>;
  private readonly HISTORY_CLEANUP_INTERVAL = 3600000; // 1 hour

  constructor() {
    super();
    this.limits = new Map();
    this.requestHistory = new Map();
    this.initializeDefaultLimits();
    this.startCleanupInterval();
  }

  private initializeDefaultLimits(): void {
    // Twitter rate limits
    this.setRateLimit(Platform.TWITTER, {
      maxRequests: 300,
      windowMs: 900000 // 15 minutes
    });

    // Discord rate limits
    this.setRateLimit(Platform.DISCORD, {
      maxRequests: 50,
      windowMs: 60000 // 1 minute
    });

    // Other platforms...
    Object.values(Platform).forEach(platform => {
      if (!this.limits.has(platform)) {
        this.setRateLimit(platform, {
          maxRequests: 100,
          windowMs: 300000 // 5 minutes
        });
      }
    });
  }

  public setRateLimit(
    platform: Platform,
    limit: Omit<RateLimit, 'platform' | 'current' | 'resetTime'>
  ): void {
    this.limits.set(platform, {
      ...limit,
      platform,
      current: 0,
      resetTime: Date.now() + limit.windowMs
    });
  }

  public async checkRateLimit(
    platform: Platform,
    endpoint: string
  ): Promise<boolean> {
    const limit = this.limits.get(platform);
    if (!limit) {
      throw new Error(`No rate limit configured for platform: ${platform}`);
    }

    // Reset if window has expired
    if (Date.now() >= limit.resetTime) {
      this.resetLimit(platform);
    }

    // Check if limit exceeded
    if (limit.current >= limit.maxRequests) {
      this.emit('limitExceeded', {
        platform,
        current: limit.current,
        max: limit.maxRequests,
        resetTime: limit.resetTime
      });
      return false;
    }

    // Track request
    this.trackRequest(platform, endpoint);
    return true;
  }

  public async waitForRateLimit(
    platform: Platform,
    endpoint: string
  ): Promise<void> {
    const limit = this.limits.get(platform);
    if (!limit) {
      throw new Error(`No rate limit configured for platform: ${platform}`);
    }

    while (!(await this.checkRateLimit(platform, endpoint))) {
      const waitTime = limit.resetTime - Date.now();
      this.emit('waiting', {
        platform,
        waitTime,
        endpoint
      });
      await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 5000)));
    }
  }

  private trackRequest(platform: Platform, endpoint: string): void {
    const limit = this.limits.get(platform)!;
    limit.current++;

    const history = this.requestHistory.get(platform) || [];
    history.push({
      timestamp: Date.now(),
      endpoint,
      successful: true
    });
    this.requestHistory.set(platform, history);

    this.emit('request', {
      platform,
      endpoint,
      current: limit.current,
      max: limit.maxRequests
    });
  }

  private resetLimit(platform: Platform): void {
    const limit = this.limits.get(platform)!;
    limit.current = 0;
    limit.resetTime = Date.now() + limit.windowMs;

    this.emit('limitReset', {
      platform,
      resetTime: limit.resetTime
    });
  }

  public getRateLimitStatus(platform: Platform): {
    remaining: number;
    resetIn: number;
    isLimited: boolean;
  } {
    const limit = this.limits.get(platform);
    if (!limit) {
      throw new Error(`No rate limit configured for platform: ${platform}`);
    }

    return {
      remaining: Math.max(0, limit.maxRequests - limit.current),
      resetIn: Math.max(0, limit.resetTime - Date.now()),
      isLimited: limit.current >= limit.maxRequests
    };
  }

  public getRequestPattern(
    platform: Platform,
    timeWindow: number = 3600000 // 1 hour default
  ): {
    totalRequests: number;
    successRate: number;
    topEndpoints: Array<{ endpoint: string; count: number }>;
  } {
    const history = this.requestHistory.get(platform) || [];
    const cutoff = Date.now() - timeWindow;
    const recentRequests = history.filter(r => r.timestamp >= cutoff);

    // Calculate metrics
    const totalRequests = recentRequests.length;
    const successfulRequests = recentRequests.filter(r => r.successful).length;
    
    // Get top endpoints
    const endpointCounts = recentRequests.reduce((acc, req) => {
      acc[req.endpoint] = (acc[req.endpoint] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topEndpoints = Object.entries(endpointCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([endpoint, count]) => ({ endpoint, count }));

    return {
      totalRequests,
      successRate: totalRequests > 0 ? successfulRequests / totalRequests : 1,
      topEndpoints
    };
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupHistory();
    }, this.HISTORY_CLEANUP_INTERVAL);
  }

  private cleanupHistory(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // Keep 24 hours of history

    for (const [platform, history] of this.requestHistory.entries()) {
      const filteredHistory = history.filter(r => r.timestamp >= cutoff);
      this.requestHistory.set(platform, filteredHistory);
    }
  }

  public getDynamicRateLimit(
    platform: Platform,
    endpoint: string
  ): number {
    const pattern = this.getRequestPattern(platform);
    const baseLimit = this.limits.get(platform)?.maxRequests || 100;

    // Adjust limit based on success rate
    let dynamicLimit = baseLimit;
    if (pattern.successRate < 0.5) {
      dynamicLimit = Math.max(10, baseLimit * 0.5);
    } else if (pattern.successRate < 0.8) {
      dynamicLimit = Math.max(20, baseLimit * 0.8);
    }

    return dynamicLimit;
  }
}