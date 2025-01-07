import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../infrastructure/database/services/RedisService';
import { AppError } from './error';
import config from '../config';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}

export const rateLimit = (options: RateLimitOptions) => {
  const redisService = RedisService.getInstance();
  const keyPrefix = options.keyPrefix || 'rate-limit:';

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Generate key based on IP and optional prefix
      const key = `${keyPrefix}${req.ip}`;

      // Get current count
      const current = await redisService.get<number>(key) || 0;

      if (current >= options.max) {
        throw new AppError(429, 'Too many requests');
      }

      // Increment counter
      await redisService.set(key, current + 1, options.windowMs / 1000);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', options.max);
      res.setHeader('X-RateLimit-Remaining', options.max - current - 1);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + options.windowMs).toISOString());

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Predefined rate limiters
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 failed auth attempts per hour
  keyPrefix: 'auth-limit:'
});

export const createTaskLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 task creations per minute
  keyPrefix: 'task-create-limit:'
}); 