# Requires -RunAsAdministrator

# Colors for output
$Green = [System.ConsoleColor]::Green
$Red = [System.ConsoleColor]::Red
$Yellow = [System.ConsoleColor]::Yellow

function Write-ColorOutput($Color, $Message) {
    Write-Host $Message -ForegroundColor $Color
}

Write-ColorOutput $Green "Starting Meme Agent Setup..."

# Function to check if a command exists
function Test-Command($Command) {
    try {
        Get-Command $Command -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

# Function to install Chocolatey
function Install-Chocolatey {
    Write-ColorOutput $Yellow "Installing Chocolatey..."
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
    refreshenv
}

# Function to install Node.js and pnpm
function Install-NodeAndPnpm {
    Write-ColorOutput $Yellow "Installing Node.js and pnpm..."
    choco install nodejs-lts -y
    refreshenv
    npm install -g pnpm
    Write-ColorOutput $Green "Node.js $(node -v) and pnpm $(pnpm -v) installed successfully"
}

# Function to install PostgreSQL
function Install-PostgreSQL {
    Write-ColorOutput $Yellow "Installing PostgreSQL..."
    choco install postgresql14 -y
    refreshenv
    
    # Start PostgreSQL service
    Start-Service postgresql-x64-14
    Set-Service -Name postgresql-x64-14 -StartupType Automatic
    
    # Create database and user
    $env:PGPASSWORD = "postgres"
    psql -U postgres -c "CREATE DATABASE meme_agent_db;"
    psql -U postgres -c "CREATE USER meme_agent WITH PASSWORD 'meme_agent_password';"
    psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE meme_agent_db TO meme_agent;"
    
    Write-ColorOutput $Green "PostgreSQL installed and configured successfully"
}

# Function to install MongoDB
function Install-MongoDB {
    Write-ColorOutput $Yellow "Installing MongoDB..."
    choco install mongodb -y
    refreshenv
    
    # Start MongoDB service
    Start-Service MongoDB
    Set-Service -Name MongoDB -StartupType Automatic
    
    Write-ColorOutput $Green "MongoDB installed and configured successfully"
}

# Function to install Redis
function Install-Redis {
    Write-ColorOutput $Yellow "Installing Redis..."
    choco install redis-64 -y
    refreshenv
    
    # Start Redis service
    Start-Service Redis
    Set-Service -Name Redis -StartupType Automatic
    
    Write-ColorOutput $Green "Redis installed and configured successfully"
}

# Function to install Solana CLI tools
function Install-Solana {
    Write-ColorOutput $Yellow "Installing Solana CLI tools..."
    
    $solanaInstaller = "https://release.solana.com/v1.17.0/solana-install-init-x86_64-pc-windows-msvc.exe"
    $installerPath = "$env:TEMP\solana-install-init.exe"
    
    # Download installer
    Invoke-WebRequest -Uri $solanaInstaller -OutFile $installerPath
    
    # Run installer
    Start-Process -FilePath $installerPath -ArgumentList "v1.17.0" -Wait
    
    Write-ColorOutput $Green "Solana CLI tools installed successfully"
}

# Check if running as administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-ColorOutput $Red "Please run as Administrator"
    exit 1
}

# Install Chocolatey if not installed
if (-not (Test-Command "choco")) {
    Install-Chocolatey
}

# Install each component
if (-not (Test-Command "node")) {
    Install-NodeAndPnpm
}

if (-not (Test-Command "psql")) {
    Install-PostgreSQL
}

if (-not (Test-Command "mongod")) {
    Install-MongoDB
}

if (-not (Test-Command "redis-server")) {
    Install-Redis
}

if (-not (Test-Command "solana")) {
    Install-Solana
}

# Create necessary directories
Write-ColorOutput $Yellow "Creating necessary directories..."
New-Item -ItemType Directory -Force -Path "logs"

# Install project dependencies
Write-ColorOutput $Yellow "Installing project dependencies..."
pnpm install

# Build the project
Write-ColorOutput $Yellow "Building the project..."
pnpm run build

# Initialize databases
Write-ColorOutput $Yellow "Initializing databases..."
pnpm run db:setup

Write-ColorOutput $Green "Installation completed successfully!"
Write-ColorOutput $Yellow "Please configure your .env file with the necessary API keys and settings."
Write-ColorOutput $Yellow "You can start the application in development mode with: pnpm run start:dev"
Write-ColorOutput $Yellow "Or in production mode with: pnpm run start:prod" 