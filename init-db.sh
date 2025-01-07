#!/bin/bash

# Create PostgreSQL database
echo "Creating PostgreSQL database..."
psql -U postgres -c "CREATE DATABASE swarm_db;"

# Run database migrations
echo "Running database migrations..."
npx typeorm migration:run -d src/infrastructure/database/postgresql.config.ts

# Start MongoDB (if not running)
echo "Starting MongoDB..."
if ! pgrep mongod > /dev/null; then
    mongod --dbpath /data/db &
fi

# Start Redis (if not running)
echo "Starting Redis..."
if ! pgrep redis-server > /dev/null; then
    redis-server &
fi

# Initialize database connections and run migrations
echo "Initializing database connections..."
ts-node src/infrastructure/database/init.ts 