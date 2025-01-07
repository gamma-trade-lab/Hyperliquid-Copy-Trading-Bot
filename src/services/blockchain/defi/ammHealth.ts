import axios from 'axios';
import { retry } from '../../../utils/common.js';

interface AMMDexHealth {
  health: number;
  volume24h: number;
  tvl: number;
}

interface AMMHealthResponse {
  [dex: string]: AMMDexHealth;
}

type HealthCheckResult = {
  [dex: string]: number;
}

export class AMMHealthChecker {
  private readonly HEALTH_THRESHOLD = 0.8;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private healthCache: Map<string, { health: number; timestamp: number }> = new Map();

  async checkHealth(tokens: string[]): Promise<HealthCheckResult> {
    const now = Date.now();
    const cacheKey = tokens.sort().join(',');
    const cached = this.healthCache.get(cacheKey);

    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      return { [cacheKey]: cached.health };
    }

    try {
      const response = await retry(async () => {
        return await axios.get<{ data: AMMHealthResponse }>('https://api.jup.ag/v1/health', {
          params: { tokens: tokens.join(',') }
        });
      });

      const healthData = response.data.data;
      const healthResult: HealthCheckResult = {};
      
      // Process and validate health data
      Object.entries(healthData).forEach(([dex, data]) => {
        if (typeof data.health === 'number' && !isNaN(data.health)) {
          healthResult[dex] = data.health;
        } else {
          console.warn(`Invalid health data for DEX ${dex}`);
          healthResult[dex] = 0;
        }
      });
      
      // Cache the results
      if (Object.keys(healthResult).length > 0) {
        const avgHealth = Object.values(healthResult).reduce((sum, h) => sum + h, 0) / Object.values(healthResult).length;
        this.healthCache.set(cacheKey, {
          health: avgHealth,
          timestamp: now
        });
      }

      return healthResult;
    } catch (error) {
      console.error('Error checking AMM health:', error);
      return {};
    }
  }


  async isHealthy(tokens: string[]): Promise<boolean> {
    const health = await this.checkHealth(tokens);
    return Object.values(health).every(h => h >= this.HEALTH_THRESHOLD);
  }
}
