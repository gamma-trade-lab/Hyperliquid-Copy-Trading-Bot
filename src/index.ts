import dotenv from 'dotenv';
import { initializeDatabases, closeDatabases } from './infrastructure/database/index.js';
import { AgentCoordinationService } from './infrastructure/database/services/AgentCoordinationService.js';
import { createServer } from './server.js';
import { Server } from 'http';
import { logger } from './utils/logger.js';

dotenv.config();

async function startApplication() {
  try {
    logger.info('Starting Meme Agent...');

    // Initialize databases
    const { mongodbInitialized } = await initializeDatabases();
    logger.info('Required databases initialized successfully');
    if (!mongodbInitialized) {
      logger.warn('MongoDB initialization skipped - continuing without MongoDB');
    }

    // Initialize agent coordination service
    const agentCoordination = AgentCoordinationService.getInstance();
    logger.info('Agent coordination service initialized');

    // Load character configuration if specified
    const characterArg = process.argv.find(arg => arg.startsWith('--character='));
    if (characterArg) {
      const characterPath = characterArg.split('=')[1];
      logger.info(`Loading character configuration from: ${characterPath}`);
      
      // Initialize character-specific services
      const twitterService = await agentCoordination.initializeTwitterService();
      logger.info('Twitter service initialized');
      
      // Start autonomous posting if character is loaded
      await agentCoordination.startAutonomousPosting();
      logger.info('Autonomous posting enabled');
    }

    // Create and start HTTP server
    const app = await createServer();
    const port = process.env.APP_PORT || 3000;
    const server: Server = app.listen(port, () => {
      logger.info(`Server is running on port ${port}`);
    });
    
    // Set up terminal interaction
    const { createInterface } = await import('readline/promises');
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    logger.info('Terminal interaction ready. Type your commands:');
    readline.on('line', async (input: string) => {
      try {
        if (input.toLowerCase() === 'exit') {
          await closeDatabases();
          readline.close();
          process.exit(0);
        }
        
        // Process commands
        const response = await agentCoordination.processCommand(input);
        logger.info(response);
      } catch (error) {
        logger.error('Error processing command:', error);
      }
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
