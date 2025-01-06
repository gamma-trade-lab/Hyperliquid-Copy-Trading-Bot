import axios from 'axios';
import { sleep } from '../../../utils/common';

export interface JupiterPriceResponse {
  data: {
    [key: string]: {
      id: string;
      mintSymbol: string;
      vsToken: string;
      vsTokenSymbol: string;
      price: number;
      confidence: number;
    }
  };
}

export class JupiterPriceV2 {
  private readonly endpoint = 'https://price.jup.ag/v2';
  private rateLimitCounter = 0;
  private lastRateLimitReset = Date.now();
  private readonly RATE_LIMIT = 600;
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MIN_CONFIDENCE = 0.5;
  private readonly MAX_RETRIES = 5;
  private readonly BATCH_SIZE = 100;

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    if (now - this.lastRateLimitReset >= this.RATE_LIMIT_WINDOW) {
      this.rateLimitCounter = 0;
      this.lastRateLimitReset = now;
    }

    if (this.rateLimitCounter >= this.RATE_LIMIT) {
      const waitTime = this.RATE_LIMIT_WINDOW - (now - this.lastRateLimitReset);
      await sleep(waitTime);
      this.rateLimitCounter = 0;
      this.lastRateLimitReset = Date.now();
    }
  }

  public async getPrices(tokenMints: string[]): Promise<JupiterPriceResponse> {
    let attempts = 0;
    while (attempts < this.MAX_RETRIES) {
      try {
        await this.checkRateLimit();
        
        // Split into batches of 100
        const batches = [];
        for (let i = 0; i < tokenMints.length; i += this.BATCH_SIZE) {
          batches.push(tokenMints.slice(i, i + this.BATCH_SIZE));
        }

        // Fetch prices for each batch
        const responses = await Promise.all(
          batches.map(async (batch) => {
            const tokens = batch.join(',');
            const response = await axios.get(`${this.endpoint}/price`, {
              params: { ids: tokens }
            });
            this.rateLimitCounter++;
            return response.data;
          })
        );

        // Merge responses
        const mergedData = responses.reduce((acc, curr) => ({
          ...acc,
          data: { ...acc.data, ...curr.data }
        }), { data: {} });

        // Filter out low confidence prices
        Object.keys(mergedData.data).forEach(key => {
          if (mergedData.data[key].confidence < this.MIN_CONFIDENCE) {
            console.warn(`Low confidence price for token ${key}: ${mergedData.data[key].confidence}`);
            delete mergedData.data[key];
          }
        });

        return mergedData;
      } catch (error) {
        attempts++;
        if (attempts === this.MAX_RETRIES) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          throw new Error(`Failed to fetch prices after ${this.MAX_RETRIES} attempts: ${errorMessage}`);
        }
        await sleep(1000 * attempts); // Exponential backoff
      }
    }
    throw new Error('Failed to fetch prices');
  }

  public async getPrice(tokenMint: string): Promise<number> {
    const response = await this.getPrices([tokenMint]);
    if (!response.data[tokenMint]) {
      throw new Error(`No price data available for token ${tokenMint}`);
    }
    return response.data[tokenMint].price;
  }
}
