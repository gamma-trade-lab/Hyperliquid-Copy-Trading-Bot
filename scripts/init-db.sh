#!/bin/bash

# Function to print colored output
print_status() {
  local color=$1
  local message=$2
  case $color in
    "green") echo -e "\033[0;32m$message\033[0m" ;;
    "red") echo -e "\033[0;31m$message\033[0m" ;;
    "yellow") echo -e "\033[0;33m$message\033[0m" ;;
    *) echo "$message" ;;
  esac
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  print_status "red" "❌ Docker is not running. Please start Docker and try again."
  exit 1
fi

# Load environment variables
if [ -f .env ]; then
  source .env
else
  print_status "red" "❌ .env file not found"
  exit 1
fi

print_status "yellow" "🚀 Starting database services..."

# Start database services using docker-compose
docker-compose up -d

# Wait for services to be healthy
print_status "yellow" "⏳ Waiting for services to be healthy..."

# Function to check service health
check_service_health() {
  local service=$1
  local max_attempts=30
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    if docker-compose ps $service | grep -q "healthy"; then
      return 0
    fi
    print_status "yellow" "   Waiting for $service... ($attempt/$max_attempts)"
    sleep 2
    ((attempt++))
  done
  return 1
}

# Check each service
services=("postgres" "mongodb" "redis")
failed_services=()

for service in "${services[@]}"; do
  if ! check_service_health $service; then
    failed_services+=($service)
  else
    print_status "green" "✅ $service is healthy"
  fi
done

if [ ${#failed_services[@]} -ne 0 ]; then
  print_status "red" "❌ The following services failed to become healthy:"
  for service in "${failed_services[@]}"; do
    print_status "red" "   - $service"
  done
  print_status "red" "Please check the logs using 'docker-compose logs'"
  exit 1
fi

print_status "yellow" "🔄 Running database migrations..."

# Run Prisma migrations
if ! pnpm prisma:generate; then
  print_status "red" "❌ Failed to generate Prisma client"
  exit 1
fi

if ! pnpm prisma:migrate; then
  print_status "red" "❌ Failed to run database migrations"
  exit 1
fi

print_status "green" "✅ Database initialization completed successfully" 