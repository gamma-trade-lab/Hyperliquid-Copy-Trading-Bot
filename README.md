# Meme Agent - Advanced AI Trading System

## Overview

Meme Agent is a sophisticated AI-powered trading system designed for the Solana ecosystem, specializing in meme tokens. The system leverages a polyglot persistence architecture and multiple AI models for advanced market analysis, automated trading, and risk management.

### Key Features

- **Multi-Model AI Integration**
  - Primary: DeepSeek (33B parameters)
  - Secondary: Groq, OpenAI GPT-4, Claude-3, Ollama
  - Model fallback and load balancing
  - Custom prompt engineering

- **Advanced Trading Capabilities**
  - Real-time market analysis and execution
  - Multi-DEX integration (Jupiter, Orca)
  - Dynamic slippage protection
  - Automated portfolio optimization
  - Social sentiment correlation

- **Data Infrastructure**
  - PostgreSQL: Structured data (users, agents, tasks)
  - MongoDB: Unstructured data (analysis, logs)
  - Redis: Caching and real-time operations
  - Distributed transaction support

- **Integration & Monitoring**
  - Birdeye & Helius market data
  - Twitter & Discord social feeds
  - Comprehensive logging system
  - Real-time metrics and alerts

## System Requirements

### Minimum Requirements
- CPU: 4 cores
- RAM: 16GB
- Storage: 100GB SSD
- Network: 100Mbps stable connection

### Software Prerequisites
- Node.js ≥18.0.0
- pnpm ≥8.0.0
- PostgreSQL ≥14.0
- MongoDB ≥6.0
- Redis ≥7.0
- Solana CLI tools

### Database Setup
1. **PostgreSQL Setup**
   ```bash
   # Install PostgreSQL
   sudo apt update
   sudo apt install postgresql postgresql-contrib
   
   # Start PostgreSQL service
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   
   # Create database and user
   sudo -u postgres psql
   CREATE DATABASE meme_agent_db;
   CREATE USER meme_agent_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE meme_agent_db TO meme_agent_user;
   ```

2. **Redis Setup**
   ```bash
   # Install Redis
   sudo apt update
   sudo apt install redis-server
   
   # Configure Redis
   sudo systemctl start redis-server
   sudo systemctl enable redis-server
   
   # Verify Redis is running
   redis-cli ping
   ```

## Quick Start

**Important:** Use `pnpm` instead of `npm` for all commands to ensure consistent package management.

1. **Clone and Setup**
   ```bash
   git clone https://github.com/kwanRoshi/meme-agent.git
   cd meme-agent
   ```

2. **Install Dependencies**
   ```bash
   # Install project dependencies
   pnpm install
   ```

3. **Database Verification**
   ```bash
   # Verify Redis connection (should return PONG)
   redis-cli ping

   # Verify PostgreSQL connection
   psql -h 127.0.0.1 -U meme_agent_user -d meme_agent_db -c '\conninfo'
   ```

4. **Environment Configuration**
   ```bash
   # Copy environment configuration
   cp .env.example .env
   ```

   Required environment variables:
   ```env
   # Redis Configuration (Required)
   REDIS_HOST=localhost        # Default: localhost
   REDIS_PORT=6379            # Default Redis port
   REDIS_PASSWORD=your_password

   # PostgreSQL Configuration (Required)
   POSTGRES_HOST=localhost     # Default: localhost
   POSTGRES_PORT=5432         # Default PostgreSQL port
   POSTGRES_USER=meme_agent_user
   POSTGRES_PASSWORD=your_password
   POSTGRES_DB=meme_agent_db
   ```

5. **Build and Start**
   ```bash
   # Build the project
   pnpm build

   # Start with default configuration
   pnpm start

   # Start with Jenna character (recommended)
   pnpm start --character=characters/jenna.character.json
   ```

## Architecture Overview

### AI Model Pipeline
- Model selection based on task complexity
- Parallel processing for high-throughput analysis
- Automatic failover and load balancing
- Response validation and quality control

### Database Architecture
- Polyglot persistence for optimal data storage
- Distributed transactions with saga pattern
- Automatic data partitioning and archiving
- Real-time caching with invalidation strategies

### Trading Engine
- Multi-DEX order routing
- Dynamic slippage adjustment
- Risk management system
- Performance monitoring
- Automated position management

## Advanced Configuration

### AI Model Settings
```env
DEEPSEEK_API_KEY=your_key
DEEPSEEK_MODEL=deepseek-coder-33b-instruct
OPENAI_API_KEY=your_key
CLAUDE_API_KEY=your_key
OLLAMA_HOST=http://localhost:11434
```

### Social Integration Settings

#### Twitter Integration
The system uses the agent-twitter-client implementation for Twitter authentication, which does not require API tokens. This approach provides a more reliable and maintainable integration method.

**Important Authentication Notes:**
1. A successful login may trigger Twitter's suspicious login notification - this is normal and expected
2. The ACID challenge (Error Code 399) is part of Twitter's normal authentication flow
3. Authentication errors don't necessarily indicate failure; the system includes retry logic

**Configuration:**
```env
# Twitter Authentication (Required)
TWITTER_USERNAME=your_twitter_username    # Twitter account username
TWITTER_PASSWORD=your_twitter_password    # Twitter account password
TWITTER_EMAIL=your_twitter_email         # Twitter account email

# Automation Settings (Optional)
CONTENT_GENERATION_INTERVAL=120000       # Content generation (2 min)
MARKET_MONITORING_INTERVAL=30000         # Market updates (30 sec)
COMMUNITY_ENGAGEMENT_INTERVAL=180000     # Community interaction (3 min)
TWEET_INTERVAL=300000                   # Tweet frequency (5 min)
```

**Important Notes:**
- The system will run in mock mode if Twitter credentials are missing
- Mock mode allows development and testing without Twitter access
- Content generation follows strict guidelines to avoid spam detection:
  - No emoji usage in tweets
  - No hashtag usage in tweets
  - Varied post formats to maintain authenticity

For detailed Twitter integration troubleshooting, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

### Trading Parameters
```env
MAX_POSITION_SIZE=1000
SLIPPAGE_TOLERANCE=0.5
RISK_LEVEL=medium
TRADING_HOURS=24/7
```

### Character Configuration
Edit `characters/jenna.character.json` to customize:
- Trading personality
- Risk tolerance
- Analysis preferences
- Communication style

## Monitoring & Maintenance

### Log Management
- `logs/error.log`: Critical issues
- `logs/combined.log`: All system events
- `logs/agents.log`: AI agent activities
- `logs/trades.log`: Trading activities

### Performance Metrics
- Trading performance dashboard
- System resource utilization
- Model performance analytics
- Network latency monitoring

### Alerts & Notifications
- Slack integration
- Discord webhooks
- Email notifications
- SMS alerts (optional)

## Security Best Practices

### API Security
- Regular key rotation
- Rate limiting
- Request validation
- IP whitelisting

### Data Protection
- Encryption at rest
- Secure key storage
- Access control
- Audit logging

### Network Security
- SSL/TLS encryption
- VPN support
- DDoS protection
- Firewall configuration

## Troubleshooting Guide

### Common Issues
1. **Database Connectivity**
   - Check service status:
     ```bash
     sudo systemctl status postgresql
     sudo systemctl status redis-server
     ```
   - Verify credentials in .env match your setup
   - Test connections:
     ```bash
     psql -h localhost -U meme_agent_user -d meme_agent_db -c '\conninfo'
     redis-cli ping
     ```
   - Review connection limits in postgresql.conf
   - Ensure services are running on correct ports (PostgreSQL: 5432, Redis: 6379)

2. **Twitter Integration**
   - Verify Twitter credentials in .env
   - Check for rate limiting issues
   - Monitor logs/social.log for authentication errors
   - Ensure character configuration is properly loaded
   - Note: Service falls back to mock mode if Twitter client is unavailable

2. **AI Model Errors**
   - Validate API keys
   - Check rate limits
   - Monitor response times
   - Verify model availability

3. **Trading Issues**
   - Confirm wallet balance
   - Check RPC endpoints
   - Verify price feeds
   - Monitor slippage

## Development & Testing

### Running Tests
```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# Load tests
pnpm test:load
```

### Code Quality
```bash
# Linting
pnpm lint

# Type checking
pnpm type-check

# Format code
pnpm format
```

### Documentation
```bash
# Generate API docs
pnpm docs

# View docs locally
pnpm docs:serve
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow coding standards
4. Add tests for new features
5. Submit a pull request

## Support & Community

- GitHub Issues: [Report bugs](https://github.com/yourusername/meme-agent/issues)

## License

MIT License - See [LICENSE](LICENSE) for details


