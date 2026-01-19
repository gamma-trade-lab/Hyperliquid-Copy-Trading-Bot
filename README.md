# Hyperliquid Copy Trading Bot

> ⚠️ **Warning**: This project is for educational purposes only — trading involves high risk of loss. Use at your own risk.

## Overview

A production-grade copy trading bot built in TypeScript (Node.js) that mirrors trades from a target Hyperliquid wallet in real-time. It listens for fills/trades, copies opens, reduces, and closes positions while applying configurable risk parameters, supports dry-run and testnet modes, and offers safety/resilience features.

## Features

### Core Functionality

- **Real-time copying**: Monitors a target wallet (public or vault address) for new fills/trades via WebSocket subscriptions, and mirrors opens, reduces, closes of positions immediately.
- **Smart risk management & sizing**:
  - Position size = `(ourAccountEquity / targetWalletEquity) * targetPositionSize * SIZE_MULTIPLIER`
  - Configurable multiplier (e.g. 0.5×, 1×, 2×)
  - Minimum notional check (skip if too small) — Hyperliquid requires ~$10 per order
  - Maximum position size cap (as % of our equity)
  - Match leverage, but cap at MAX_LEVERAGE
  - Blocked assets support (skip certain assets)
  - Limit on max concurrent open trades

### Safety & Resilience

- **Dry-run / simulation mode**: Log actions without placing real orders
- **Testnet support**: Toggleable via config
- **Graceful reconnects**: Automatic WebSocket reconnection on disconnect with exponential backoff
- **Rate limiting**: Respects API limits with extra safety layer
- **Error handling & retries**: Automatic retry logic for failed orders

### Configuration & Validation

- `.env` + `zod` schema for strong typed config
- Required: `PRIVATE_KEY`, `TARGET_WALLET`, `TESTNET` (boolean)
- Optional: `SIZE_MULTIPLIER`, `MAX_LEVERAGE`, `BLOCKED_ASSETS` (array), `DRY_RUN`, `LOG_LEVEL`

### Architecture & Code Quality

- Modern TypeScript (ESM, strict mode)
- Modular structure: separate modules for config, SDK init, monitoring, execution, logger, types, etc.
- Async/await, concurrency where necessary
- Comprehensive logging (info, warn, error) with timestamps via `winston`
- Full type safety using SDK types
- CLI script (e.g. `npm start`)
- Comments & notes on Hyperliquid specifics (e.g. no trailing zeros in size/price, GTC orders, etc.)

### Bonus Features

- **Telegram notifications**: Optional notifications when trades are copied (via `node-telegram-bot-api`)
- **Basic PnL tracking**: Compare our account vs target
- **Health checks**: Periodically verify our positions (every 5 minutes by default)

## Tech Stack & Dependencies

- **Node.js** (ESM), **TypeScript** with `strict` enabled
- **SDK**: `@nktkas/hyperliquid` (preferred community SDK)
- **Other libs**:
  - `dotenv` - Environment variable management
  - `zod` - Config schema validation
  - `winston` - Logging
  - `ethers` - Wallet management
  - `ws` - WebSocket support
  - Optional: `node-telegram-bot-api` - Telegram notifications

## Project Structure

```
hyperliquid-copy-bot/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
├── src/
│   ├── index.ts                 # Main entry point
│   ├── config.ts                # Configuration with zod validation
│   ├── hyperliquidClient.ts    # Hyperliquid SDK wrapper
│   ├── copyTrader.ts            # Core copy trading logic
│   ├── logger.ts                # Winston logger setup
│   ├── types.ts                 # TypeScript type definitions
│   ├── utils/
│   │   ├── risk.ts              # Risk management utilities
│   │   └── healthCheck.ts       # Health check utility
│   └── notifications/
│       └── telegram.ts          # Telegram notification service
└── logs/                        # Log files (auto-created)
```

## Setup & Installation

### Prerequisites

- Node.js 18+ (ESM support)
- npm or yarn
- Hyperliquid account (testnet or mainnet)

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hyperliquid-copy-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and fill in your values:
   ```env
   PRIVATE_KEY=0xYourPrivateKeyHere
   TARGET_WALLET=0xTargetWalletAddressHere
   TESTNET=true
   SIZE_MULTIPLIER=1.0
   MAX_LEVERAGE=20
   DRY_RUN=true
   ```

4. **Build TypeScript** (optional, can run directly with tsx)
   ```bash
   npm run build
   ```

5. **Start the bot**
   ```bash
   npm start
   ```

## Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PRIVATE_KEY` | Your wallet private key (0x prefix) | `0x1234...` |
| `TARGET_WALLET` | Target wallet address to copy | `0x5678...` |
| `TESTNET` | Use testnet (true/false) | `true` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SIZE_MULTIPLIER` | Position size multiplier | `1.0` |
| `MAX_LEVERAGE` | Maximum leverage cap | `20` |
| `MAX_POSITION_SIZE_PERCENT` | Max position size as % of equity | `50` |
| `MIN_NOTIONAL` | Minimum order size in USD | `10` |
| `MAX_CONCURRENT_TRADES` | Max concurrent open positions | `10` |
| `BLOCKED_ASSETS` | Comma-separated blocked assets | `` |
| `DRY_RUN` | Simulation mode (true/false) | `false` |
| `LOG_LEVEL` | Logging level (error/warn/info/debug) | `info` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (optional) | - |
| `TELEGRAM_CHAT_ID` | Telegram chat ID (optional) | - |
| `HEALTH_CHECK_INTERVAL` | Health check interval in minutes | `5` |

## Usage

### Basic Usage

1. **Testnet Testing** (Recommended first)
   ```env
   TESTNET=true
   DRY_RUN=true
   ```
   This allows you to test the bot without risking real funds.

2. **Production Mode**
   ```env
   TESTNET=false
   DRY_RUN=false
   ```
   ⚠️ **Only enable after thorough testing!**

### How It Works

1. **Initialization**: Bot loads config, initializes Hyperliquid client, connects to your wallet
2. **Monitoring**: Subscribes to target wallet fills via WebSocket
3. **On Fill Event**:
   - Determines if it's opening, reducing, or closing a position
   - Fetches our and target wallet equity
   - Calculates position size: `(ourEquity / targetEquity) * targetSize * multiplier`
   - Applies risk checks (min notional, max size, blocked assets, leverage cap)
   - Executes trade (or logs in dry-run mode)
4. **Health Checks**: Periodically compares our positions vs target positions
5. **Notifications**: Sends Telegram notifications (if configured)

### Position Sizing Example

If:
- Target wallet equity: $10,000
- Our wallet equity: $5,000
- Target opens $1,000 position
- SIZE_MULTIPLIER: 1.0

Then our position size = `(5000 / 10000) * 1000 * 1.0 = $500`

### Risk Management

The bot includes multiple safety layers:

1. **Minimum Notional**: Skips trades below $10 (Hyperliquid requirement)
2. **Maximum Position Size**: Caps position at configured % of equity
3. **Leverage Cap**: Limits leverage to MAX_LEVERAGE
4. **Blocked Assets**: Skips copying certain coins
5. **Max Concurrent Trades**: Limits number of open positions
6. **Dry-Run Mode**: Test without placing real orders

## Hyperliquid SDK References

### SDK Compatibility Note

⚠️ **Important**: The Hyperliquid TypeScript SDK landscape is evolving. The code uses `@nktkas/hyperliquid` as the preferred SDK, but you may need to adjust imports based on the actual SDK structure.

**Options**:
1. **@nktkas/hyperliquid** (preferred) - Community SDK
   - Install: `npm install @nktkas/hyperliquid`
   - GitHub: https://github.com/nktkas/hyperliquid

2. **nomeida/hyperliquid** (alternative) - Another community SDK
   - Check npm for availability

3. **Direct API calls** - If no SDK is available, implement direct HTTP/WebSocket calls
   - Official API docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api

**If SDK import fails**: The code includes error handling and will guide you. You may need to:
- Adjust import paths in `src/hyperliquidClient.ts`
- Implement direct API calls using `fetch` or `axios` for HTTP
- Use `ws` library for WebSocket connections

- **Official Hyperliquid Docs**: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api

- **Testnet**:
  - Chain ID: 998
  - Faucet: https://app.hyperliquid-testnet.xyz/drip
  - Testnet Explorer: https://explorer.hyperliquid-testnet.xyz

### Important Hyperliquid Notes

- **No trailing zeros**: Size and price must not have trailing zeros (e.g., `"1.5"` not `"1.50"`)
- **GTC orders**: Orders are Good Till Cancel by default
- **Minimum notional**: ~$10 minimum per order
- **Leverage**: Must be set per coin before placing orders

## Logging & Monitoring

### Log Files

- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only

### Log Levels

- `error` - Errors only
- `warn` - Warnings and errors
- `info` - Info, warnings, and errors (default)
- `debug` - Verbose logging

### Key Events Logged

- Subscription start/stop
- Detected fill events
- Trade opened/reduced/closed
- Skipped trades (due to filters)
- Errors & retries
- Health check results

## Telegram Notifications (Bonus)

When enabled, sends notifications when trades are copied:

```
🔄 Trade Copied

📊 Target Trade:
• Coin: BTC
• Side: Open Long
• Size: 0.1
• Price: 50000

📈 Our Trade:
• Side: Long
• Size: 0.05
• Leverage: 10x
• Reduce Only: No

✅ Status: Success
• Order ID: 12345
```

### Setup Telegram Notifications

1. Create a Telegram bot via [@BotFather](https://t.me/botfather)
2. Get your bot token
3. Get your chat ID (send message to bot, then visit `https://api.telegram.org/bot<TOKEN>/getUpdates`)
4. Add to `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token
   TELEGRAM_CHAT_ID=your_chat_id
   ```

## Health Checks

The bot periodically checks positions:

- Compares our positions vs target positions
- Detects drift (size differences)
- Logs warnings if significant drift detected
- Default interval: 5 minutes (configurable)

## Troubleshooting

### Common Issues

1. **"Failed to import Hyperliquid SDK"**
   - Run: `npm install @nktkas/hyperliquid`
   - If package doesn't exist, check alternative SDKs or use official API

2. **"Cannot connect to Hyperliquid account"**
   - Verify `PRIVATE_KEY` is correct
   - Check network connectivity
   - Ensure testnet/mainnet matches your account

3. **"WebSocket disconnected"**
   - Bot will auto-reconnect with exponential backoff
   - Check network stability
   - Verify target wallet address is correct

4. **"Trade execution failed"**
   - Check account balance
   - Verify minimum notional requirements
   - Check if asset is blocked
   - Review leverage limits

### Debug Mode

Enable debug logging:
```env
LOG_LEVEL=debug
```

## Risks & Disclaimers

⚠️ **IMPORTANT WARNINGS**:

- **High Risk**: Trading derivatives involves significant risk of loss
- **Leverage Risk**: Leverage amplifies both gains and losses
- **Capital Loss**: You may lose your entire capital
- **No Warranty**: This software is provided "as is" without warranty
- **Educational Purpose**: This is for educational purposes only
- **Test First**: Always test on testnet before using real funds
- **Private Key Security**: Never share your private key. Store securely.

## Development

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Code Structure

- **Modular design**: Each component in separate file
- **Type safety**: Full TypeScript types throughout
- **Error handling**: Comprehensive try-catch blocks
- **Logging**: Structured logging at all levels

## Contributing

Contributions welcome! Please ensure:

- TypeScript strict mode compliance
- All tests pass
- Code is well-documented
- Follow existing code style

## License

MIT License — free to use, modify, but no warranty.

## Support

For issues, questions, or contributions:

1. Check existing GitHub issues
2. Review Hyperliquid documentation
3. Test on testnet first
4. Enable debug logging for troubleshooting

## Getting Started with Testnet

1. Visit https://app.hyperliquid-testnet.xyz/drip
2. Get testnet tokens from faucet
3. Set `TESTNET=true` in `.env`
4. Set `DRY_RUN=true` for initial testing
5. Start bot: `npm start`

## CLI Commands

```bash
npm start          # Start the bot
npm run build      # Build TypeScript
npm run dev        # Development mode with watch
```

## Example .env File

```env
# Required
PRIVATE_KEY=0xYourPrivateKeyHere
TARGET_WALLET=0xTargetWalletAddressHere
TESTNET=true

# Position Sizing & Risk Management
SIZE_MULTIPLIER=1.0
MAX_LEVERAGE=20
MAX_POSITION_SIZE_PERCENT=50
MIN_NOTIONAL=10
MAX_CONCURRENT_TRADES=10

# Asset Filtering
BLOCKED_ASSETS=BTC,ETH

# Safety Features
DRY_RUN=true
LOG_LEVEL=info

# Optional: Telegram Notifications
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Optional: Health Check Interval (minutes)
HEALTH_CHECK_INTERVAL=5
```

---

**Remember**: This is for educational purposes — trading involves high risk of loss. Always test on testnet first!
