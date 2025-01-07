import dotenv from 'dotenv';
import { initializeDatabases, closeDatabases } from './infrastructure/database';
import { AgentCoordinationService } from './infrastructure/database/services/AgentCoordinationService';
import { createServer } from './server';
import { logger } from './utils/logger';

dotenv.config();

async function startApplication() {
  try {
    // Initialize databases
    await initializeDatabases();
    logger.info('Databases initialized successfully');

    // Initialize agent coordination service
    const agentCoordination = AgentCoordinationService.getInstance();
    logger.info('Agent coordination service initialized');

    // Create and start HTTP server
    const server = await createServer();
    const port = process.env.APP_PORT || 3000;
    
    server.listen(port, () => {
      logger.info(`Server is running on port ${port}`);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received. Starting graceful shutdown...');
      
      // Close server
      server.close(() => {
        logger.info('HTTP server closed');
      });

      // Close database connections
      await closeDatabases();
      
      process.exit(0);
    });

  } catch (error) {
    logger.error('Error starting application:', error);
    await closeDatabases();
    process.exit(1);
  }
}

startApplication();
