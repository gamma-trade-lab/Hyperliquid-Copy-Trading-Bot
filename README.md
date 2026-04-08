# Hyperliquid Copy Trading Bot

A copy trading bot for Hyperliquid that automatically mirrors positions from a leader wallet.

## Prerequisites

- Python 3.8 or higher
- A Hyperliquid account with a funded wallet
- The wallet address of the trader you want to copy

## Setup Instructions

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

Or install individually:
```bash
pip install ccxt requests python-dotenv
```

### 2. Create Environment Variables File

Create a `.env` file in the project directory with your credentials:

```env
# Your account credentials (required for LIVE mode, optional for DRY mode)
HYPERLIQUID_WALLET_ADDRESS=0xYourWalletAddress
HYPERLIQUID_PRIVATE_KEY=0xYourPrivateKey

# Who to copy trade from
LEADER_WALLET_ADDRESS=0xLeaderWalletAddress

# Mode settings
DRY_MODE=true  # Set to "false" to enable live trading

# Trading settings
POSITION_SIZE_MULTIPLIER=1.0
LEVERAGE=1
MARGIN_MODE=isolated
```

**Important:** Never commit your `.env` file to git! It contains sensitive information.

### 3. Run the Bot

#### One-time execution:
```bash
python hyperliquid-trading-live-bot.py
```

#### Continuous monitoring (using a loop):
You can run it in a loop or schedule it with cron/task scheduler:

**Windows (PowerShell):**
```powershell
while ($true) { python hyperliquid-trading-live-bot.py; Start-Sleep -Seconds 10 }
```

**Linux/Mac:**
```bash
while true; do python hyperliquid-trading-live-bot.py; sleep 10; done
```

**Or use cron (Linux/Mac) to run every minute:**
```bash
* * * * * cd /path/to/bot && /usr/bin/python3 hyperliquid-trading-live-bot.py
```

## Configuration Options

### Required Environment Variables:
- `LEADER_WALLET_ADDRESS` - Wallet address to copy from

### Required for LIVE Mode (when DRY_MODE=false):
- `HYPERLIQUID_WALLET_ADDRESS` - Your wallet address
- `HYPERLIQUID_PRIVATE_KEY` - Your wallet's private key

### Optional Environment Variables:
- `DRY_MODE` - If "true", only tracks leader positions without executing trades (default: true)
- `POSITION_SIZE_MULTIPLIER` - Position size multiplier (default: 1.0)
- `LEVERAGE` - Leverage to use (default: 1)
- `MARGIN_MODE` - "isolated" or "cross" (default: isolated)
- `POLL_INTERVAL` - Seconds between checks (default: 10)
- `MIN_POSITION_SIZE` - Minimum position size in USDC (default: 10.0)
- `USE_TP_SL` - Copy take profit/stop loss (default: false)

## How It Works

1. **Fetches Leader Positions**: Queries the leader wallet's open positions via Hyperliquid API
2. **Compares Positions**: Checks your current positions against the leader's (in LIVE mode)
3. **Closes Mismatched Positions**: Closes any positions you have that the leader doesn't (LIVE mode only)
4. **Opens New Positions**: Opens positions to match the leader proportionally (LIVE mode only)
5. **Adjusts Sizes**: Adjusts position sizes when they differ from the leader (LIVE mode only)

### Dry Mode vs Live Mode

- **DRY_MODE=true** (default): Only tracks and displays what trades would be executed. No actual trades are placed. Perfect for testing and monitoring.
- **DRY_MODE=false**: Executes actual trades to mirror the leader's positions. Requires valid wallet credentials.

## Safety Features

- Minimum position size filter (avoids dust positions)
- Symbol blocking capability
- Proportional position sizing
- Error handling and logging

## Troubleshooting

### Common Issues:

1. **"LEADER_WALLET_ADDRESS must be set"**
   - Make sure your `.env` file exists and contains `LEADER_WALLET_ADDRESS`

2. **"Failed to initialize exchange"**
   - Check that your `HYPERLIQUID_WALLET_ADDRESS` and `HYPERLIQUID_PRIVATE_KEY` are correct
   - Ensure your wallet has funds

3. **"Failed to fetch wallet positions"**
   - Check that `LEADER_WALLET_ADDRESS` is a valid Hyperliquid wallet
   - Verify your internet connection

4. **Module not found errors**
   - Run `pip install -r requirements.txt` to install dependencies

## Disclaimer

⚠️ **Use at your own risk!** This bot executes real trades with real money. Always:
- Test with small amounts first
- Understand the risks of copy trading
- Monitor the bot regularly
- The leader trader may lose money, and you will copy those losses

## License

This code is provided as-is for educational purposes.

