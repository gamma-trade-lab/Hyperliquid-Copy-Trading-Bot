import os
import ccxt
import requests
import time
from dotenv import load_dotenv

load_dotenv()


# ==========================================
# PART 1: HYPERLIQUID CLIENT
# ==========================================

class HyperliquidClient:
    """Simple synchronous client for Hyperliquid exchange using CCXT."""
    
    def __init__(self, wallet_address: str, private_key: str):
        """Initialize the Hyperliquid client.
        
        Args:
            wallet_address: Your Hyperliquid wallet address
            private_key: Your wallet's private key
        """
        if not wallet_address:
            raise ValueError("wallet_address is required")
        
        if not private_key:
            raise ValueError("private_key is required")
            
        try:
            self.exchange = ccxt.hyperliquid({
                "walletAddress": wallet_address,
                "privateKey": private_key,
                "enableRateLimit": True,
            })
            self.markets = {}
            self._load_markets()
        except Exception as e:
            raise Exception(f"Failed to initialize exchange: {str(e)}")

    def _load_markets(self) -> None:
        """Load market data from the exchange."""
        try:
            self.markets = self.exchange.load_markets()
        except Exception as e:
            raise Exception(f"Failed to load markets: {str(e)}")

    def _amount_to_precision(self, symbol: str, amount: float) -> float:
        """Convert amount to exchange precision requirements.
        
        Args:
            symbol: Trading pair symbol
            amount: Order amount to format
            
        Returns:
            Amount formatted with correct precision as float
        """
        try:
            result = self.exchange.amount_to_precision(symbol, amount)
            return float(result)
        except Exception as e:
            raise Exception(f"Failed to format amount precision: {str(e)}")

    def _price_to_precision(self, symbol: str, price: float) -> float:
        """Convert price to exchange precision requirements.
        
        Args:
            symbol: Trading pair symbol
            price: Order price to format
            
        Returns:
            Price formatted with correct precision as float
        """
        try:
            result = self.exchange.price_to_precision(symbol, price)
            return float(result)
        except Exception as e:
            raise Exception(f"Failed to format price precision: {str(e)}")

    def get_current_price(self, symbol: str) -> float:
        """Get the current market price for a symbol.
        
        Args:
            symbol: Trading pair (e.g., "ETH/USDC:USDC")
            
        Returns:
            Current market price
        """
        try:
            return float(self.markets[symbol]["info"]["midPx"])
        except Exception as e:
            raise Exception(f"Failed to get price for {symbol}: {str(e)}")

    def fetch_balance(self) -> dict:
        """Fetch account balance information.
        
        Returns:
            Account balance data
        """
        try:
            result = self.exchange.fetch_balance()
            return result
        except Exception as e:
            raise Exception(f"Failed to fetch balance: {str(e)}")

    def fetch_positions(self, symbols: list[str] | None = None) -> list:
        """Fetch open positions for specified symbols.
        
        Args:
            symbols: List of trading pairs (optional, if None fetches all positions)
            
        Returns:
            List of position dictionaries with active positions
        """
        try:
            # Hyperliquid doesn't support fetching multiple symbols at once
            # If symbols provided, fetch one at a time, otherwise fetch all
            if symbols and len(symbols) > 0:
                all_positions = []
                for symbol in symbols:
                    try:
                        positions = self.exchange.fetch_positions([symbol])
                        all_positions.extend(positions)
                    except Exception:
                        # Skip symbols that fail
                        continue
                return [pos for pos in all_positions if float(pos.get("contracts", 0)) != 0]
            else:
                # Fetch all positions by calling without symbols
                positions = self.exchange.fetch_positions()
                return [pos for pos in positions if float(pos.get("contracts", 0)) != 0]
        except Exception as e:
            raise Exception(f"Failed to fetch positions: {str(e)}")

    def fetch_ohlcv(self, symbol: str, timeframe: str = "1d", limit: int = 100) -> pd.DataFrame:
        """Fetch OHLCV candlestick data.
        
        Args:
            symbol: Trading pair symbol
            timeframe: Candle interval (1m, 5m, 15m, 30m, 1h, 4h, 12h, 1d)
            limit: Maximum number of candles to fetch
            
        Returns:
            DataFrame with OHLCV data
        """
        try:
            ohlcv_data = self.exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
            
            df = pd.DataFrame(
                data=ohlcv_data,
                columns=["timestamp", "open", "high", "low", "close", "volume"]
            )
            df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
            df = df.set_index("timestamp").sort_index()
            
            numeric_cols = ["open", "high", "low", "close", "volume"]
            df[numeric_cols] = df[numeric_cols].astype(float)
            
            return df
        except Exception as e:
            raise Exception(f"Failed to fetch OHLCV data: {str(e)}")
    
    def set_leverage(self, symbol: str, leverage: int) -> bool:
        """Set leverage for a symbol.
        
        Args:
            symbol: Trading pair symbol
            leverage: Leverage multiplier
            
        Returns:
            True if successful
        """
        try:
            self.exchange.set_leverage(leverage, symbol)
            return True
        except Exception as e:
            raise Exception(f"Failed to set leverage: {str(e)}")

    def set_margin_mode(self, symbol: str, margin_mode: str, leverage: int) -> bool:
        """Set margin mode for a symbol.
        
        Args:
            symbol: Trading pair symbol
            margin_mode: "isolated" or "cross"
            leverage: Required leverage multiplier for Hyperliquid
            
        Returns:
            True if successful
        """
        try:
            self.exchange.set_margin_mode(margin_mode, symbol, params={"leverage": leverage})
            return True
        except Exception as e:
            raise Exception(f"Failed to set margin mode: {str(e)}")

    def place_market_order(
        self, 
        symbol: str, 
        side: str, 
        amount: float,
        reduce_only: bool = False,
        take_profit_price: float | None = None,
        stop_loss_price: float | None = None
    ) -> dict:
        """Place a market order with optional take profit and stop loss.
        
        Args:
            symbol: Trading pair symbol
            side: "buy" or "sell"
            amount: Order size in contracts
            reduce_only: If True, order will only reduce position size
            take_profit_price: Optional price level to take profit
            stop_loss_price: Optional price level to stop loss
            
        Returns:
            Order execution details
        """
        try:
            formatted_amount = self._amount_to_precision(symbol, amount)
            
            price = float(self.markets[symbol]["info"]["midPx"])
            formatted_price = self._price_to_precision(symbol, price)
            
            params = {"reduceOnly": reduce_only}
            
            if take_profit_price is not None:
                formatted_tp_price = self._price_to_precision(symbol, take_profit_price)
                params["takeProfitPrice"] = formatted_tp_price
                
            if stop_loss_price is not None:
                formatted_sl_price = self._price_to_precision(symbol, stop_loss_price)
                params["stopLossPrice"] = formatted_sl_price
            
            order_info = {}
            order_info_final = {}
            
            order_info["market_order"] = self.exchange.create_order(
                symbol=symbol,
                type="market",
                side=side,
                amount=formatted_amount,
                price=formatted_price,
                params=params
            )
            order_info_final["market_order"] = order_info["market_order"]["info"]
            
            if take_profit_price is not None:
                order_info["take_profit_order"] = self._place_take_profit_order(symbol, side, formatted_amount, formatted_price, take_profit_price)
                order_info_final["take_profit_order"] = order_info["take_profit_order"]["info"]
                
            if stop_loss_price is not None:
                order_info["stop_loss_order"] = self._place_stop_loss_order(symbol, side, formatted_amount, formatted_price, stop_loss_price)
                order_info_final["stop_loss_order"] = order_info["stop_loss_order"]["info"]
            
            return order_info_final
        except Exception as e:
            raise Exception(f"Failed to place market order: {str(e)}")

    def _place_take_profit_order(self, symbol: str, side: str, amount: float, price: float, take_profit_price: float) -> dict:
        """Internal method to place a take-profit order."""
        tp_price = self._price_to_precision(symbol, take_profit_price)
        close_side = "sell" if side == "buy" else "buy"
        return self.exchange.create_order(
                symbol=symbol,
                type="market",
                side=close_side,
                amount=amount,
                price=price,
                params={"takeProfitPrice": tp_price, "reduceOnly": True},
            )

    def _place_stop_loss_order(self, symbol: str, side: str, amount: float, price: float, stop_loss_price: float) -> dict:
        """Internal method to place a stop-loss order."""
        sl_price = self._price_to_precision(symbol, stop_loss_price)
        close_side = "sell" if side == "buy" else "buy"
        return self.exchange.create_order(
                symbol=symbol,
                type="market",
                side=close_side,
                amount=amount,
                price=price,
                params={"stopLossPrice": sl_price, "reduceOnly": True},
            )
    
    def fetch_wallet_positions(self, wallet_address: str, verbose: bool = False) -> list:
        """Fetch positions for a given wallet address using Hyperliquid public API.
        
        Args:
            wallet_address: The wallet address to fetch positions for
            verbose: If True, print debug information
            
        Returns:
            List of position dictionaries
        """
        try:
            # Hyperliquid public API endpoint
            url = "https://api.hyperliquid.xyz/info"
            
            # Ensure wallet address is lowercase (Hyperliquid API requirement)
            wallet_address_lower = wallet_address.lower()
            
            payload = {
                "type": "clearinghouseState",
                "user": wallet_address_lower
            }
            
            if verbose:
                print(f"[DEBUG] Fetching positions for wallet: {wallet_address_lower}")
                print(f"[DEBUG] API URL: {url}")
                print(f"[DEBUG] Payload: {payload}")
            
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if verbose:
                print(f"[DEBUG] API Response keys: {list(data.keys())}")
                if "assetPositions" in data:
                    print(f"[DEBUG] Found {len(data['assetPositions'])} asset positions in response")
            
            positions = []
            if "assetPositions" in data:
                for pos in data["assetPositions"]:
                    position = pos.get("position", {})
                    contracts = float(position.get("szi", 0))
                    
                    # Coin is in the position dict, not at the top level
                    coin = position.get("coin", "")
                    
                    if verbose:
                        print(f"[DEBUG] Position: coin={coin}, contracts={contracts}, position_data={position}")
                    
                    if contracts != 0 and coin:
                        # Determine side
                        side = "long" if contracts > 0 else "short"
                        
                        # Convert to CCXT symbol format (e.g., "ETH/USDC:USDC")
                        symbol = f"{coin}/USDC:USDC"
                        
                        positions.append({
                            "symbol": symbol,
                            "side": side,
                            "contracts": abs(contracts),
                            "entryPrice": float(position.get("entryPx", 0)),
                            "unrealizedPnl": float(position.get("unrealizedPnl", 0)),
                            "coin": coin
                        })
            
            if verbose:
                print(f"[DEBUG] Returning {len(positions)} positions")
            
            return positions
        except Exception as e:
            if verbose:
                print(f"[DEBUG] Error fetching positions: {e}")
                import traceback
                traceback.print_exc()
            raise Exception(f"Failed to fetch wallet positions: {str(e)}")


def my_print(message: str, verbose: bool):
    if verbose:
        print(message)


# ==========================================
# PART 2: COPY TRADING CONFIG
# ==========================================

# Copy trading parameters
config = {
    "leader_wallet_address": os.getenv("LEADER_WALLET_ADDRESS", ""),  # Wallet to copy from
    "position_size_multiplier": float(os.getenv("POSITION_SIZE_MULTIPLIER", "1.0")),  # Multiplier for position sizing (1.0 = same size ratio, 0.5 = half, 2.0 = double)
    "leverage": int(os.getenv("LEVERAGE", "1")),  # Leverage to use
    "margin_mode": os.getenv("MARGIN_MODE", "isolated"),  # "isolated" or "cross"
    "use_tp_sl": os.getenv("USE_TP_SL", "false").lower() == "true",  # Whether to copy TP/SL from leader
    "poll_interval": int(os.getenv("POLL_INTERVAL", "10")),  # Seconds between position checks
    "min_position_size": float(os.getenv("MIN_POSITION_SIZE", "10.0")),  # Minimum position size in USDC
    "dry_mode": os.getenv("DRY_MODE", "true").lower() == "true",  # If true, only track/monitor without executing trades
}

# Verbosity
verbose = True

# Blocked symbols (symbols you don't want to copy)
blocked_symbols = []  # Add symbols like ["BTC/USDC:USDC"] to block them


def normalize_position(position: dict) -> dict:
    """Normalize position data for comparison."""
    return {
        "symbol": position.get("symbol", ""),
        "side": position.get("side", "").lower(),
        "contracts": abs(float(position.get("contracts", 0))),
    }


def find_position_by_symbol(positions: list, symbol: str) -> dict | None:
    """Find a position in a list by symbol."""
    for pos in positions:
        if pos.get("symbol") == symbol:
            return pos
    return None


def calculate_proportional_size(leader_contracts: float, leader_balance: float, follower_balance: float, multiplier: float) -> float:
    """Calculate position size based on balance ratio.
    
    Args:
        leader_contracts: Number of contracts the leader has
        leader_balance: Leader's account balance
        follower_balance: Follower's account balance
        multiplier: Size multiplier (1.0 = proportional, 0.5 = half, 2.0 = double)
        
    Returns:
        Number of contracts for follower
    """
    if leader_balance == 0:
        return 0
    
    ratio = (follower_balance / leader_balance) * multiplier
    return leader_contracts * ratio


# ==========================================
# PART 3: COPY TRADING BOT
# ==========================================

def run_copy_trading_cycle(client, config, verbose, blocked_symbols):
    """Run a single copy trading cycle."""
    try:
        # Fetch leader positions (always available via public API)
        # fetch_wallet_positions uses public API, so we can call it even without a full client
        if client:
            leader_positions = client.fetch_wallet_positions(config["leader_wallet_address"], verbose=verbose)
        else:
            # In dry mode without client, fetch directly using requests
            url = "https://api.hyperliquid.xyz/info"
            # Ensure wallet address is lowercase (Hyperliquid API requirement)
            wallet_address_lower = config["leader_wallet_address"].lower()
            payload = {"type": "clearinghouseState", "user": wallet_address_lower}
            
            if verbose:
                my_print(f"[DEBUG] Fetching positions for wallet: {wallet_address_lower}", verbose)
                my_print(f"[DEBUG] API URL: {url}", verbose)
                my_print(f"[DEBUG] Payload: {payload}", verbose)
            
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if verbose:
                my_print(f"[DEBUG] API Response keys: {list(data.keys())}", verbose)
                if "assetPositions" in data:
                    my_print(f"[DEBUG] Found {len(data['assetPositions'])} asset positions in response", verbose)
            
            leader_positions = []
            if "assetPositions" in data:
                for pos in data["assetPositions"]:
                    position = pos.get("position", {})
                    contracts = float(position.get("szi", 0))
                    
                    # Coin is in the position dict, not at the top level
                    coin = position.get("coin", "")
                    
                    if verbose:
                        my_print(f"[DEBUG] Position: coin={coin}, contracts={contracts}, position_data={position}", verbose)
                    
                    if contracts != 0 and coin:
                        symbol = f"{coin}/USDC:USDC"
                        leader_positions.append({
                            "symbol": symbol,
                            "side": "long" if contracts > 0 else "short",
                            "contracts": abs(contracts),
                            "entryPrice": float(position.get("entryPx", 0)),
                            "unrealizedPnl": float(position.get("unrealizedPnl", 0)),
                            "coin": coin
                        })
        
        my_print(f"Leader has {len(leader_positions)} open position(s)", verbose)
        
        # Display leader positions in a readable format
        if leader_positions:
            my_print("\n=== Leader's Positions ===", verbose)
            for i, pos in enumerate(leader_positions, 1):
                entry_price = pos.get("entryPrice", 0)
                unrealized_pnl = pos.get("unrealizedPnl", 0)
                pnl_sign = "+" if unrealized_pnl >= 0 else ""
                my_print(f"{i}. {pos['symbol']}: {pos['side'].upper()} {pos['contracts']:.4f} contracts | Entry: ${entry_price:.2f} | PnL: {pnl_sign}${unrealized_pnl:.2f}", verbose)
            my_print("", verbose)
        
        if verbose and len(leader_positions) == 0:
            my_print(f"[DEBUG] No positions found. Check if wallet address '{config['leader_wallet_address']}' is correct and has open positions.", verbose)
        
        # Get follower balance and positions (only if not in dry mode or if client is available)
        follower_balance = 1000.0  # Default for dry mode
        follower_positions = []
        follower_positions_normalized = []
        
        if client and not config["dry_mode"]:
            follower_balance_info = client.fetch_balance()
            follower_balance = float(follower_balance_info["total"]["USDC"])
            my_print(f"Follower balance: {follower_balance} USDC", verbose)
            
            # Fetch all follower positions (without specifying symbols to avoid DEX limitation)
            follower_positions = client.fetch_positions()
            follower_positions_normalized = [normalize_position(pos) for pos in follower_positions]
            my_print(f"Follower has {len(follower_positions)} open position(s)", verbose)
        elif config["dry_mode"]:
            my_print("DRY MODE: Skipping follower balance/position fetch (tracking leader only)", verbose)
            # Use a default balance for calculations in dry mode
            follower_balance = 1000.0  # Default for display purposes
        
        leader_positions_normalized = [normalize_position(pos) for pos in leader_positions]
        
        # Estimate leader balance from their positions (rough estimate)
        leader_balance = follower_balance  # Default fallback
        if leader_positions:
            # Try to get a better estimate - for now use follower balance as baseline
            # In production, you might want to fetch leader's actual balance if available
            leader_balance = follower_balance * 2  # Placeholder - adjust based on your needs

        # ==========================================
        # 5. Close Positions Not in Leader's Portfolio
        # ==========================================
        for follower_pos in follower_positions_normalized:
            symbol = follower_pos["symbol"]
            
            # Skip if symbol is blocked
            if symbol in blocked_symbols:
                continue
            
            # Check if leader has this position
            leader_pos = find_position_by_symbol(leader_positions_normalized, symbol)
            
            if not leader_pos:
                # Leader doesn't have this position - close it
                if config["dry_mode"]:
                    my_print(f"[DRY MODE] Would close position {symbol} (not in leader's portfolio) - {follower_pos['contracts']:.4f} contracts", verbose)
                else:
                    my_print(f"Closing position {symbol} (not in leader's portfolio)", verbose)
                    side = "sell" if follower_pos["side"] == "long" else "buy"
                    try:
                        client.place_market_order(
                            symbol,
                            side,
                            follower_pos["contracts"],
                            reduce_only=True
                        )
                        my_print(f"Closed {symbol} position", verbose)
                    except Exception as e:
                        my_print(f"Error closing {symbol}: {e}", verbose)

        # ==========================================
        # 6. Open/Adjust Positions to Match Leader
        # ==========================================
        for leader_pos in leader_positions_normalized:
            symbol = leader_pos["symbol"]
            
            # Skip if symbol is blocked
            if symbol in blocked_symbols:
                my_print(f"Skipping blocked symbol: {symbol}", verbose)
                continue
            
            try:
                # Get current price
                current_price = client.get_current_price(symbol)
                
                # Calculate target position size
                target_contracts = calculate_proportional_size(
                    leader_pos["contracts"],
                    leader_balance,
                    follower_balance,
                    config["position_size_multiplier"]
                )
                
                # Check minimum position size
                position_value = target_contracts * current_price
                if position_value < config["min_position_size"]:
                    my_print(f"Skipping {symbol} - position size too small ({position_value:.2f} USDC)", verbose)
                    continue
                
                # Check if follower already has this position
                follower_pos = find_position_by_symbol(follower_positions_normalized, symbol)
                
                if follower_pos:
                    # Position exists - check if it needs adjustment
                    current_contracts = follower_pos["contracts"]
                    side_match = follower_pos["side"] == leader_pos["side"]
                    
                    # Check if size or side needs adjustment
                    size_diff = abs(target_contracts - current_contracts)
                    size_threshold = current_contracts * 0.05  # 5% threshold to avoid micro-adjustments
                    
                    if not side_match:
                        # Side mismatch - close and reopen
                        if config["dry_mode"]:
                            my_print(f"[DRY MODE] Would adjust {symbol}: side mismatch (follower: {follower_pos['side']}, leader: {leader_pos['side']})", verbose)
                            my_print(f"[DRY MODE] Would close {current_contracts:.4f} contracts and open {target_contracts:.4f} {leader_pos['side']} contracts", verbose)
                        else:
                            my_print(f"Adjusting {symbol}: side mismatch (follower: {follower_pos['side']}, leader: {leader_pos['side']})", verbose)
                            close_side = "sell" if follower_pos["side"] == "long" else "buy"
                            client.place_market_order(
                                symbol,
                                close_side,
                                current_contracts,
                                reduce_only=True
                            )
                        follower_pos = None  # Mark as closed
                    elif size_diff > size_threshold:
                        # Size needs adjustment
                        if config["dry_mode"]:
                            my_print(f"[DRY MODE] Would adjust {symbol}: size mismatch (follower: {current_contracts:.4f}, target: {target_contracts:.4f})", verbose)
                            adjust_amount = abs(target_contracts - current_contracts)
                            action = "increase" if target_contracts > current_contracts else "decrease"
                            my_print(f"[DRY MODE] Would {action} position by {adjust_amount:.4f} contracts", verbose)
                        else:
                            my_print(f"Adjusting {symbol}: size mismatch (follower: {current_contracts:.4f}, target: {target_contracts:.4f})", verbose)
                            if target_contracts > current_contracts:
                                # Increase position
                                adjust_amount = target_contracts - current_contracts
                                side = "buy" if leader_pos["side"] == "long" else "sell"
                            else:
                                # Decrease position
                                adjust_amount = current_contracts - target_contracts
                                side = "sell" if leader_pos["side"] == "long" else "buy"
                            
                            client.place_market_order(
                                symbol,
                                side,
                                adjust_amount,
                                reduce_only=(target_contracts < current_contracts)
                            )
                            my_print(f"Adjusted {symbol} position", verbose)
                        continue
                    else:
                        # Position matches - no action needed
                        my_print(f"Position {symbol} already matches leader", verbose)
                        continue
                
                # Open new position
                if not follower_pos:
                    if config["dry_mode"]:
                        my_print(f"[DRY MODE] Would open new position: {symbol} {leader_pos['side']} {target_contracts:.4f} contracts (value: ${position_value:.2f})", verbose)
                    else:
                        my_print(f"Opening new position: {symbol} {leader_pos['side']} {target_contracts:.4f} contracts", verbose)
                        
                        # Set leverage and margin mode
                        try:
                            client.set_leverage(symbol, config["leverage"])
                            client.set_margin_mode(symbol, config["margin_mode"], config["leverage"])
                        except Exception as e:
                            my_print(f"Warning: Could not set leverage/margin for {symbol}: {e}", verbose)
                        
                        # Place order
                        side = "buy" if leader_pos["side"] == "long" else "sell"
                        
                        orders = client.place_market_order(
                            symbol,
                            side,
                            target_contracts,
                            take_profit_price=None,  # Copy trading typically doesn't copy TP/SL
                            stop_loss_price=None
                        )
                        
                        if orders.get("market_order"):
                            my_print(f"Opened {symbol} {leader_pos['side']} position: {target_contracts:.4f} contracts", verbose)
                        else:
                            my_print(f"Failed to open {symbol} position", verbose)
                        
            except Exception as e:
                my_print(f"Error processing {symbol}: {e}", verbose)
                continue

        # Summary
        if config["dry_mode"]:
            my_print("\n=== DRY MODE SUMMARY ===", verbose)
            my_print(f"Leader positions tracked: {len(leader_positions)}", verbose)
            my_print("No trades were executed (DRY MODE)", verbose)
        else:
            my_print("\n=== Copy Trading Summary ===", verbose)
            my_print(f"Leader positions: {len(leader_positions)}", verbose)
            my_print(f"Follower positions: {len(follower_positions)}", verbose)
            my_print("Copy trading cycle completed", verbose)
        
        return True
        
    except Exception as e:
        my_print(f"Error in copy trading cycle: {e}", verbose)
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    
    try:
        # ==========================================
        # 1. Validate Configuration
        # ==========================================
        if not config["leader_wallet_address"]:
            raise ValueError("LEADER_WALLET_ADDRESS must be set in environment variables or .env file")
        
        # ==========================================
        # 2. Initialize Client (once at startup)
        # ==========================================
        wallet_address = os.getenv("HYPERLIQUID_WALLET_ADDRESS")
        private_key = os.getenv("HYPERLIQUID_PRIVATE_KEY")
        
        # In dry mode, credentials are optional (only needed for tracking leader)
        # In live mode, credentials are required
        if not config["dry_mode"]:
            if not wallet_address or not private_key:
                raise ValueError("HYPERLIQUID_WALLET_ADDRESS and HYPERLIQUID_PRIVATE_KEY must be set when DRY_MODE=false")
            client = HyperliquidClient(wallet_address, private_key)
        else:
            # In dry mode, create a minimal client if credentials available, otherwise use None
            if wallet_address and private_key:
                client = HyperliquidClient(wallet_address, private_key)
            else:
                client = None
        
        # Display mode
        mode_text = "DRY MODE (Tracking Only)" if config["dry_mode"] else "LIVE MODE (Copy Trading)"
        my_print(f"=== {mode_text} ===", verbose)
        if client:
            my_print(f"Initialized client for wallet: {wallet_address if wallet_address else 'N/A'}", verbose)
        my_print(f"Monitoring leader: {config['leader_wallet_address']}", verbose)
        my_print(f"Poll interval: {config['poll_interval']} seconds", verbose)
        my_print(f"Starting real-time copy trading...\n", verbose)

        # ==========================================
        # Real-time Copy Trading Loop
        # ==========================================
        cycle_count = 0
        
        try:
            while True:
                cycle_count += 1
                from datetime import datetime
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                my_print(f"\n{'='*60}", verbose)
                my_print(f"[{timestamp}] Cycle #{cycle_count}", verbose)
                my_print(f"{'='*60}", verbose)
                
                # Run copy trading cycle
                success = run_copy_trading_cycle(client, config, verbose, blocked_symbols)
                
                if not success:
                    my_print(f"Cycle #{cycle_count} failed, will retry in {config['poll_interval']} seconds...", verbose)
                
                # Wait before next cycle
                my_print(f"\nWaiting {config['poll_interval']} seconds until next check...", verbose)
                time.sleep(config["poll_interval"])
                
        except KeyboardInterrupt:
            my_print("\n\nCopy trading stopped by user (Ctrl+C)", verbose)
            my_print(f"Total cycles completed: {cycle_count}", verbose)
            exit(0)
        
    except Exception as e:
        my_print(f"Fatal error in copy trading bot: {e}", verbose)
        import traceback
        traceback.print_exc()
        exit(1) 