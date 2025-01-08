#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Starting Meme Agent Setup...${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Please run as root (use sudo)${NC}"
  exit 1
fi

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function to install Node.js and pnpm
install_node() {
  echo -e "${YELLOW}Installing Node.js and pnpm...${NC}"
  
  # Install Node.js 18.x
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt-get install -y nodejs
  
  # Install pnpm
  npm install -g pnpm
  
  echo -e "${GREEN}Node.js $(node -v) and pnpm $(pnpm -v) installed successfully${NC}"
}

# Function to install and configure PostgreSQL
install_postgres() {
  echo -e "${YELLOW}Installing PostgreSQL...${NC}"
  
  # Add PostgreSQL repository
  sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
  wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
  apt-get update
  
  # Install PostgreSQL
  apt-get install -y postgresql-14
  
  # Start PostgreSQL service
  systemctl start postgresql
  systemctl enable postgresql
  
  # Create database and user
  sudo -u postgres psql -c "CREATE DATABASE meme_agent_db;"
  sudo -u postgres psql -c "CREATE USER meme_agent WITH PASSWORD 'meme_agent_password';"
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE meme_agent_db TO meme_agent;"
  
  echo -e "${GREEN}PostgreSQL installed and configured successfully${NC}"
}

# Function to install and configure MongoDB
install_mongodb() {
  echo -e "${YELLOW}Installing MongoDB...${NC}"
  
  # Add MongoDB repository
  wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add -
  echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
  apt-get update
  
  # Install MongoDB
  apt-get install -y mongodb-org
  
  # Start MongoDB service
  systemctl start mongod
  systemctl enable mongod
  
  echo -e "${GREEN}MongoDB installed and configured successfully${NC}"
}

# Function to install and configure Redis
install_redis() {
  echo -e "${YELLOW}Installing Redis...${NC}"
  
  # Install Redis
  apt-get install -y redis-server
  
  # Configure Redis to listen on all interfaces
  sed -i 's/bind 127.0.0.1/bind 0.0.0.0/' /etc/redis/redis.conf
  
  # Start Redis service
  systemctl start redis-server
  systemctl enable redis-server
  
  echo -e "${GREEN}Redis installed and configured successfully${NC}"
}

# Function to install Solana CLI tools
install_solana() {
  echo -e "${YELLOW}Installing Solana CLI tools...${NC}"
  
  sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)"
  
  echo -e "${GREEN}Solana CLI tools installed successfully${NC}"
}

# Main installation process
echo -e "${YELLOW}Updating system packages...${NC}"
apt-get update
apt-get upgrade -y

# Install basic dependencies
apt-get install -y curl wget git build-essential

# Install each component
if ! command_exists node; then
  install_node
fi

if ! command_exists psql; then
  install_postgres
fi

if ! command_exists mongod; then
  install_mongodb
fi

if ! command_exists redis-server; then
  install_redis
fi

if ! command_exists solana; then
  install_solana
fi

# Install project dependencies
echo -e "${YELLOW}Installing project dependencies...${NC}"
pnpm install

# Build the project
echo -e "${YELLOW}Building the project...${NC}"
pnpm run build

# Initialize databases
echo -e "${YELLOW}Initializing databases...${NC}"
pnpm run db:setup

echo -e "${GREEN}Installation completed successfully!${NC}"
echo -e "${YELLOW}Please configure your .env file with the necessary API keys and settings.${NC}"
echo -e "${YELLOW}You can start the application in development mode with: pnpm run start:dev${NC}"
echo -e "${YELLOW}Or in production mode with: pnpm run start:prod${NC}" 