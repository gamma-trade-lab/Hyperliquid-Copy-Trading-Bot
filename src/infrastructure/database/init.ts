import { initializeDatabases, closeDatabases } from './index';
import { PostgresDataSource } from './postgresql.config';
import dotenv from 'dotenv';

dotenv.config();

async function initializeDatabase() {
  try {
    // Initialize all database connections
    await initializeDatabases();
    console.log('Database connections established');

    // Run PostgreSQL migrations
    await PostgresDataSource.runMigrations();
    console.log('Database migrations completed');

    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Error initializing databases:', error);
    await closeDatabases();
    process.exit(1);
  }
}

// Run initialization if this script is executed directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('Database initialization script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database initialization script failed:', error);
      process.exit(1);
    });
} 