#!/bin/bash

# Exit on any error
set -e

echo "Starting Redis cleanup and reinstallation..."

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Complete cleanup of existing Redis installation
cleanup_redis() {
    echo "Performing complete Redis cleanup..."
    
    # Stop all Redis processes
    sudo pkill -f redis-server || true
    
    # Remove existing Redis installation
    sudo apt-get remove --purge -y redis-server redis-tools || true
    sudo apt-get autoremove -y
    
    # Clean up Redis directories and files
    sudo rm -rf /etc/redis /var/lib/redis /var/log/redis /var/run/redis
    sudo rm -f /etc/systemd/system/redis*
    sudo rm -f /lib/systemd/system/redis*
    
    # Reset systemd
    sudo systemctl daemon-reload
    
    echo "Cleanup completed."
}

# Perform initial cleanup
cleanup_redis

# Install Redis
echo "Installing Redis..."
sudo apt-get update
sudo apt-get install -y redis-server

# Stop Redis for configuration
sudo systemctl stop redis-server || true

# Create fresh Redis configuration
echo "Setting up Redis configuration..."
sudo mkdir -p /etc/redis
cat << EOF | sudo tee /etc/redis/redis.conf
port 6379
bind 127.0.0.1
supervised systemd
daemonize yes
dir /var/lib/redis
maxmemory 512mb
maxmemory-policy allkeys-lru
EOF

# Setup directories with proper permissions
echo "Setting up Redis directories..."
sudo mkdir -p /var/lib/redis
sudo mkdir -p /var/run/redis
sudo chown redis:redis /var/lib/redis
sudo chown redis:redis /var/run/redis
sudo chmod 750 /var/lib/redis
sudo chmod 750 /var/run/redis

# Configure system settings
echo "Configuring system settings..."
if ! grep -q "vm.overcommit_memory = 1" /etc/sysctl.conf; then
    echo 'vm.overcommit_memory = 1' | sudo tee -a /etc/sysctl.conf
fi
sudo sysctl vm.overcommit_memory=1

# Disable THP
echo "Disabling Transparent Huge Pages..."
if [ -f /sys/kernel/mm/transparent_hugepage/enabled ]; then
    echo 'never' | sudo tee /sys/kernel/mm/transparent_hugepage/enabled
fi

# Create systemd service file
echo "Creating systemd service file..."
cat << EOF | sudo tee /lib/systemd/system/redis-server.service
[Unit]
Description=Advanced key-value store
After=network.target
Documentation=http://redis.io/documentation, man:redis-server(1)

[Service]
Type=notify
ExecStart=/usr/bin/redis-server /etc/redis/redis.conf
PIDFile=/run/redis/redis-server.pid
TimeoutStopSec=0
Restart=always
User=redis
Group=redis
RuntimeDirectory=redis
RuntimeDirectoryMode=2755

UMask=007
PrivateTmp=yes
LimitNOFILE=65535
PrivateDevices=yes
ProtectHome=yes
ProtectSystem=full
ReadWritePaths=-/var/lib/redis
ReadWritePaths=-/var/log/redis
ReadWritePaths=-/var/run/redis

NoNewPrivileges=true
CapabilityBoundingSet=~CAP_SYS_PTRACE

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and start Redis
echo "Starting Redis service..."
sudo systemctl daemon-reload
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify Redis is running
echo "Verifying Redis installation..."
sleep 2  # Give Redis a moment to start

if redis-cli ping > /dev/null 2>&1; then
    echo "Redis is running successfully!"
    redis-cli ping
else
    echo "Error: Redis is not responding. Checking status..."
    sudo systemctl status redis-server
    exit 1
fi