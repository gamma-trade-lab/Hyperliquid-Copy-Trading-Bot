import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      id: string;
      startTime: number;
    }
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Add request ID and start time
  req.id = uuidv4();
  req.startTime = Date.now();

  // Log request
  logger.info('Incoming request', {
    id: req.id,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    const level = res.statusCode >= 400 ? 'error' : 'info';

    logger[level]('Request completed', {
      id: req.id,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`
    });
  });

  next();
};

export const errorLogger = (error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Error processing request', {
    id: req.id,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      query: req.query,
      body: req.body
    }
  });

  next(error);
};

export const performanceLogger = (threshold = 1000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      const duration = Date.now() - req.startTime;
      
      if (duration > threshold) {
        logger.warn('Slow request detected', {
          id: req.id,
          method: req.method,
          url: req.originalUrl,
          duration: `${duration}ms`,
          threshold: `${threshold}ms`
        });
      }
    });

    next();
  };
}; 