import { DataSource } from 'typeorm';
import dotenv from 'dotenv';

dotenv.config();

export const PostgresDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB || 'swarm_db',
  entities: ['dist/infrastructure/database/entities/**/*.js'],
  migrations: ['dist/infrastructure/database/migrations/**/*.js'],
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
});

export const initializePostgres = async () => {
  try {
    await PostgresDataSource.initialize();
    console.log('PostgreSQL Database initialized');
  } catch (error) {
    console.error('Error initializing PostgreSQL:', error);
    throw error;
  }
};      