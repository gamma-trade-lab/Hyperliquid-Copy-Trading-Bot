#!/bin/bash

# Check if databases are running
echo "Checking database services..."

# Check PostgreSQL
if ! pg_isready > /dev/null; then
    echo "PostgreSQL is not running. Starting..."
    pg_ctl -D /usr/local/var/postgres start
fi

# Check MongoDB
if ! pgrep mongod > /dev/null; then
    echo "MongoDB is not running. Starting..."
    mongod --dbpath /data/db &
fi

# Check Redis
if ! pgrep redis-server > /dev/null; then
    echo "Redis is not running. Starting..."
    redis-server &
fi

# Wait for services to be ready
sleep 5

# Start the development server with nodemon
echo "Starting development server..."
nodemon --watch 'src/**/*.ts' --exec 'ts-node' src/index.ts 