import { ChainId, getToken, getTokenBalances } from "@lifi/sdk";
import { kv } from "@vercel/kv";
import type { Asset, Log, Portfolio, Allocation, Trade } from "@/types/portfolio";
import { swapSolToToken, type SwapResult } from "./jup";
import logger from "./logger";


// Token addresses
const WSOL_ADDRESS = "So11111111111111111111111111111111111111112";
const USDC_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const WBTC_ADDRESS = "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh";

/**
 * Execute swap between tokens using Jupiter
 */ 
async function executeSwap(
  fromToken: Asset,
  toToken: Asset,
  amountLamports: number,
  execute = false
): Promise<SwapResult> {
  try {
    // Convert amount to SOL if needed
    const amountInSol = fromToken.symbol === 'SOL' 
      ? amountLamports / 1e9
      : (amountLamports * parseFloat(fromToken.priceUSD)) / 1e9;

    return await swapSolToToken(amountInSol, toToken.address);
  } catch (error) {
    logger.error('Swap execution failed:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Fetches and calculates current portfolio state
 */
export async function getPortfolio(walletAddress: string, log = true): Promise<Portfolio> {
  try {
    const chainId = ChainId.SOL;
    const tokens = await Promise.all([
      getToken(chainId, WSOL_ADDRESS),
      getToken(chainId, USDC_ADDRESS),
      getToken(chainId, WBTC_ADDRESS)
    ]);

    const tokenBalances = await getTokenBalances(walletAddress, tokens);
    let totalValue = 0;
    const assets: Asset[] = [];

    // Process each token balance
    for (const balance of tokenBalances) {
      const amountFloat = !balance.amount
        ? 0
        : Number(balance.amount) / Math.pow(10, balance.decimals);
      const value = amountFloat * parseFloat(balance.priceUSD);
      
      totalValue += value;
      assets.push({
        symbol: balance.symbol,
        name: balance.name,
        amount: amountFloat,
        amountLamports: Number(balance.amount ?? 0),
        priceUSD: balance.priceUSD,
        valueUSD: value,
        decimals: balance.decimals,
        address: balance.address
      });
    }

    // Calculate percentages
    const percentages = calculatePercentages(assets, totalValue);

    // Log portfolio state if requested
    if (log) {
      await logPortfolioState({
        time: new Date().toISOString(),
        total: totalValue,
        assets: assets.map(a => ({
          symbol: a.symbol,
          price: a.priceUSD,
          value: a.valueUSD,
          amount: a.amount
        })),
        percentages
      });
    }

    return {
      totalValueUSD: totalValue,
      assets,
      percentages
    };
  } catch (error) {
    logger.error("Failed to get portfolio:", error);
    throw error;
  }
}

/**
 * Calculates asset percentages in portfolio
 */
function calculatePercentages(assets: Asset[], total: number): Allocation {
  return assets.reduce((acc, asset) => {
    acc[asset.symbol] = Math.floor((asset.valueUSD / total) * 100) + "%";
    return acc;
  }, {} as Allocation);
}

/**
 * Logs portfolio state to database
 */
async function logPortfolioState(log: Log): Promise<void> {
  try {
    await kv.lpush("portfolioLogs", log);
  } catch (error) {
    logger.error("Failed to log portfolio state:", error);
  }
}

/**
 * Calculates necessary trades to reach target allocation
 */
export function getTrades(current: Allocation, target: Allocation): Trade[] {
  const trades: Trade[] = [];
  
  // Convert percentage strings to numbers
  const currentNums = Object.entries(current).reduce((acc, [key, value]) => {
    acc[key] = parseInt(value);
    return acc;
  }, {} as Record<string, number>);

  const targetNums = Object.entries(target).reduce((acc, [key, value]) => {
    acc[key] = parseInt(value);
    return acc;
  }, {} as Record<string, number>);

  // Calculate differences and create trades
  Object.keys(currentNums).forEach(symbol => {
    const diff = (targetNums[symbol] || 0) - (currentNums[symbol] || 0);
    if (diff > 0) {
      // Need to buy this asset
      trades.push({
        from: 'USDC', // Default to using USDC for buys
        to: symbol,
        percentage: Math.abs(diff)
      });
    } else if (diff < 0) {
      // Need to sell this asset
      trades.push({
        from: symbol,
        to: 'USDC',
        percentage: Math.abs(diff)
      });
    }
  });

  return trades;
}

/**
 * Executes rebalancing trades to match target allocation
 */
export async function rebalancePortfolio(
  current: Portfolio,
  targetAllocation: Allocation,
  execute = false
): Promise<{ status: string; message?: string; trades?: Trade[]; transactions?: SwapResult[] }> {
  try {
    const trades = getTrades(current.percentages, targetAllocation);
    
    if (!trades.length) {
      return { status: "No trades needed" };
    }

    const transactions: SwapResult[] = [];

    for (const trade of trades) {
      if (trade.percentage < 3) {
        transactions.push({
          status: 'error',
          message: "Less than 3% change, ignoring"
        });
        continue;
      }

      const sellAsset = current.assets.find(a => a.symbol === trade.from);
      const buyAsset = current.assets.find(a => a.symbol === trade.to);

      if (!sellAsset || !buyAsset) {
        throw new Error(`Missing assets for trade: ${trade.from} -> ${trade.to}`);
      }

      const amountUSD = trade.percentage / parseFloat(sellAsset.priceUSD);
      let lamports = Math.floor(amountUSD * 10 ** sellAsset.decimals);
      
      // Check if we're trying to sell more than we have
      if (lamports > sellAsset.amountLamports) {
        lamports = sellAsset.amountLamports;
      }

      const result = await executeSwap(sellAsset, buyAsset, lamports, execute);
      transactions.push(result);
    }

    return {
      status: "success",
      trades,
      transactions
    };
  } catch (error) {
    logger.error("Rebalancing failed:", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}
