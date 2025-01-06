import { promisify } from 'util';

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const retry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error = new Error('Unknown error occurred');
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === maxRetries) break;
      await sleep(delay * attempt); // Exponential backoff
    }
  }
  throw lastError;
};
