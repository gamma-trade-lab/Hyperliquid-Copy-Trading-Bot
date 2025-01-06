
# Meme Agent

An AI-driven platform for autonomous market analysis, trading, and social media engagement.

## Features

### Market Analysis & Trading
- Multi-period market analysis using Jupiter API
- Volatility-based position management with dynamic adjustments
- Cross-DEX arbitrage detection and execution
- Automatic risk management with dynamic stop-loss
- Market sentiment analysis from multiple sources

### Social Media Integration
- Autonomous Twitter posting and engagement
- AI-powered content generation
- Community engagement tracking
- Multi-platform social metrics analysis

### Technical Infrastructure
- Redis caching with compression optimization
- Circuit breaker pattern for API resilience
- Automatic error recovery and retries
- Memory usage and API rate limit monitoring
- Enhanced type safety across services

## Installation

```bash
git clone https://github.com/arhansuba/meme-agent.git
cd meme-agent
pnpm install
```

## Dependencies

Key dependencies include:
```json
{
  "ioredis": "^5.3.2",
  "agent-twitter-client": "latest",
  "@jup-ag/core": "latest",
  "@solana/web3.js": "latest",
  "groq-sdk": "0.9.1"
}
```

## Configuration

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Configure required environment variables in `.env`:
```plaintext
# AI Configuration
- GROQ_API_KEY
- AI_MODEL
- AI_TEMPERATURE

# Blockchain Configuration
- SOLANA_RPC_URL
- NETWORK_TYPE
- PROGRAM_ID

# Social Media Configuration
- TWITTER_API_KEY
- TWITTER_API_SECRET
- DISCORD_TOKEN

# Redis Configuration
- REDIS_URL
- REDIS_PASSWORD
```

## Usage

Start the agent with a character configuration:
```bash
pnpm start --character="characters/[character-name].character.json"
```

## Architecture

### Core Components
- Market Analysis Engine
  * Price monitoring and analysis
  * Volatility tracking
  * Sentiment analysis
- Trading Engine
  * Position management
  * Risk assessment
  * Order execution
- Social Integration
  * Twitter automation
  * Discord integration
  * Community engagement
- Data Processing
  * Redis caching
  * Rate limiting
  * Circuit breakers

### Modified Files
Recent updates include changes to:
- src/services/market/volatility/VolatilityManager.ts (Position management)
- src/services/market/data/DataProcessor.ts (Market data processing)
- src/services/blockchain/defi/tradingEngine.ts (Trading logic)
- src/services/social/twitter.ts (Twitter integration)
- src/services/ai/tweetGenerator.ts (Content generation)
- src/services/memory/agentMemoryIntegration.ts (AI memory)

## Development

```bash
# Install dependencies
pnpm install

# Run linting
pnpm run lint

# Fix linting issues
pnpm run lint --fix

# Build the project
pnpm run build
```

## Testing

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test src/services/ai/__tests__/tweetGenerator.test.ts
```

## Contributing

1. Create a new branch:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes and commit:
```bash
git add .
git commit -m "feat: add your feature"
```

3. Push changes and create PR:
```bash
git push origin feature/your-feature-name
```


