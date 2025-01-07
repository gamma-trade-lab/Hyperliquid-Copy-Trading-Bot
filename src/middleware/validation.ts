import { Request, Response, NextFunction } from 'express';
import { ZodSchema, z } from 'zod';
import { AppError } from './error';

export const validate = <T>(schema: ZodSchema<T>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });

      // Add validated data to request
      req.body = data.body;
      req.query = data.query;
      req.params = data.params;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new AppError(400, 'Validation error', error.errors));
      } else {
        next(error);
      }
    }
  };
};

// Common validation schemas
export const idSchema = z.object({
  id: z.string().uuid()
});

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10)
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime()
});

// Agent validation schemas
export const createAgentSchema = z.object({
  body: z.object({
    name: z.string().min(3).max(50),
    type: z.string(),
    description: z.string().min(10),
    capabilities: z.array(z.string()).optional(),
    configuration: z.record(z.any()).optional()
  })
});

export const updateAgentSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    name: z.string().min(3).max(50).optional(),
    description: z.string().min(10).optional(),
    capabilities: z.array(z.string()).optional(),
    configuration: z.record(z.any()).optional(),
    isActive: z.boolean().optional()
  })
});

// Task validation schemas
export const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(100),
    description: z.string().min(10),
    agentId: z.string().uuid(),
    input: z.record(z.any()).optional(),
    metadata: z.record(z.any()).optional()
  })
});

export const updateTaskStatusSchema = z.object({
  params: z.object({
    taskId: z.string().uuid()
  }),
  body: z.object({
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED']),
    result: z.any().optional()
  })
}); 