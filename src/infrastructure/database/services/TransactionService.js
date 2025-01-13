import { PostgresDataSource } from '../postgresql.config.js';
import { RedisService } from './RedisService.js';
export class TransactionService {
    static instance;
    redisService;
    constructor() {
        this.redisService = RedisService.getInstance();
    }
    static getInstance() {
        if (!TransactionService.instance) {
            TransactionService.instance = new TransactionService();
        }
        return TransactionService.instance;
    }
    /**
     * Execute a distributed transaction with saga pattern
     * @param steps Array of transaction steps
     * @param compensations Array of compensation functions for each step
     */
    async executeSaga(steps, compensations) {
        const results = [];
        const lockKey = `saga_lock_${Date.now()}`;
        try {
            // Acquire distributed lock
            const lockAcquired = await this.redisService.acquireLock(lockKey, 30); // 30 seconds TTL
            if (!lockAcquired) {
                throw new Error('Failed to acquire distributed lock');
            }
            // Execute each step in the saga
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                try {
                    // Execute step within a transaction
                    const result = await PostgresDataSource.transaction(async (manager) => {
                        return await step(manager);
                    });
                    results.push(result);
                    // Cache intermediate result
                    await this.redisService.set(`saga_step_${i}`, result);
                }
                catch (error) {
                    // Step failed, execute compensations in reverse order
                    console.error(`Saga step ${i} failed:`, error);
                    for (let j = i - 1; j >= 0; j--) {
                        try {
                            const compensation = compensations[j];
                            const stepResult = results[j];
                            await PostgresDataSource.transaction(async (manager) => {
                                await compensation(stepResult, manager);
                            });
                            // Clear cached result
                            await this.redisService.delete(`saga_step_${j}`);
                        }
                        catch (compensationError) {
                            console.error(`Compensation ${j} failed:`, compensationError);
                            // Log compensation failure but continue with other compensations
                        }
                    }
                    throw error;
                }
            }
            return results;
        }
        finally {
            // Release the distributed lock
            await this.redisService.releaseLock(lockKey);
        }
    }
    /**
     * Execute a simple transaction within PostgreSQL
     */
    async executeTransaction(operation) {
        return await PostgresDataSource.transaction(async (manager) => {
            return await operation(manager);
        });
    }
    /**
     * Execute operations with eventual consistency
     */
    async executeEventualConsistent(operation, eventName, metadata) {
        try {
            // Execute the main operation
            const result = await operation();
            // Publish event for eventual consistency
            await this.redisService.publish('eventual_consistency', {
                eventName,
                data: result,
                metadata,
                timestamp: new Date()
            });
            return result;
        }
        catch (error) {
            console.error('Eventual consistency operation failed:', error);
            throw error;
        }
    }
}
