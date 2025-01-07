import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../infrastructure/database/services/RedisService';
import { PostgresDataSource } from '../infrastructure/database/postgresql.config';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';

interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  services: {
    postgres: {
      status: 'ok' | 'error';
      message?: string;
    };
    mongodb: {
      status: 'ok' | 'error';
      message?: string;
    };
    redis: {
      status: 'ok' | 'error';
      message?: string;
    };
  };
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

export const healthCheck = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const redisService = RedisService.getInstance();
    const status: HealthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        postgres: { status: 'ok' },
        mongodb: { status: 'ok' },
        redis: { status: 'ok' }
      },
      uptime: process.uptime(),
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
      }
    };

    // Check PostgreSQL
    try {
      await PostgresDataSource.query('SELECT 1');
    } catch (error) {
      status.services.postgres = {
        status: 'error',
        message: (error as Error).message
      };
      status.status = 'error';
    }

    // Check MongoDB
    try {
      if (mongoose.connection.readyState !== 1) {
        throw new Error('MongoDB not connected');
      }
    } catch (error) {
      status.services.mongodb = {
        status: 'error',
        message: (error as Error).message
      };
      status.status = 'error';
    }

    // Check Redis
    try {
      await redisService.set('health-check', 'ok', 10);
      const result = await redisService.get('health-check');
      if (result !== 'ok') {
        throw new Error('Redis read/write check failed');
      }
    } catch (error) {
      status.services.redis = {
        status: 'error',
        message: (error as Error).message
      };
      status.status = 'error';
    }

    // Log health check results
    if (status.status === 'error') {
      logger.error('Health check failed', status);
    } else {
      logger.info('Health check passed', status);
    }

    // Set appropriate status code
    const statusCode = status.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(status);
  } catch (error) {
    next(error);
  }
};

export const readinessCheck = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const checks = await Promise.all([
      PostgresDataSource.query('SELECT 1'),
      mongoose.connection.readyState === 1,
      RedisService.getInstance().get('ready-check')
    ]);

    const isReady = checks.every(Boolean);
    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ok' : 'error',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
}; 