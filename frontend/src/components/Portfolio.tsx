//Portfolio.tsx
import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { elizaLogger } from "@ai16z/eliza";
import { SolanaTokenDataByTickerTool } from '@/tools/dexscreener/token_data_ticker';
import { getPortfolio } from '@/utils/portfolio';
import { Asset } from '@/types/portfolio';

interface TokenBalance {
  token: string;
  symbol: string;
  balance: number;
  value: number;
  price: number;
  change24h: number;
}

interface PortfolioStats {
  totalValue: number;
  change24h: number;
  topToken: TokenBalance | null;
  tokenCount: number;
}

interface PortfolioProps {
  walletAddress?: string;
  onError?: (error: Error) => void;
}

export default function Portfolio({ walletAddress, onError }: PortfolioProps) {
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [stats, setStats] = useState<PortfolioStats>({
    totalValue: 0,
    change24h: 0,
    topToken: null,
    tokenCount: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (walletAddress) {
      loadPortfolio();
    }
  }, [walletAddress]);

  const loadPortfolio = async () => {
    if (!walletAddress) return;

    setIsLoading(true);
    setError(null);

    try {
      // Get token balances
      const balances = await getPortfolio(walletAddress);
      
      // Get price data for tokens
      const tokenDataArray = await Promise.all(
        balances.assets.map((balance: Asset) => 
          SolanaTokenDataByTickerTool.getTokenPrice(balance.symbol)
        )
      );

      // Convert array to object indexed by symbol
      const tokenData = balances.assets.reduce((acc, balance, index) => ({
        ...acc,
        [balance.symbol]: tokenDataArray[index]
      }), {} as Record<string, any>);

      // Combine data
      const portfolioTokens = balances.assets.map((balance: Asset) => ({
        token: balance.symbol,
        symbol: balance.symbol,
        balance: balance.amount,
        price: tokenData[balance.symbol]?.price || 0,
        value: balance.amount * (tokenData[balance.symbol]?.price || 0),
        change24h: tokenData[balance.symbol]?.priceChange24h || 0
      }));

      // Sort by value
      portfolioTokens.sort((a: { value: number; }, b: { value: number; }) => b.value - a.value);

      // Calculate stats
      const totalValue = portfolioTokens.reduce((sum: any, token: { value: any; }) => sum + token.value, 0);
      const weightedChange = portfolioTokens.reduce(
        (sum: number, token: { change24h: number; value: number; }) => sum + (token.change24h * (token.value / totalValue)),
        0
      );

      setTokens(portfolioTokens);
      setStats({
        totalValue,
        change24h: weightedChange,
        topToken: portfolioTokens[0] || null,
        tokenCount: portfolioTokens.length
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load portfolio';
      setError(message);
      onError?.(error instanceof Error ? error : new Error(message));
    } finally {
      setIsLoading(false);
    }
  };

  if (!walletAddress) {
    return (
      <div className="text-center text-gray-600 dark:text-gray-400">
        Connect wallet to view portfolio
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Portfolio Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <h4 className="text-sm text-gray-600 dark:text-gray-400">Total Value</h4>
            <p className="text-2xl font-bold">${stats.totalValue.toFixed(2)}</p>
            <p className={`text-sm ${stats.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {stats.change24h.toFixed(2)}% (24h)
            </p>
          </div>
          <div>
            <h4 className="text-sm text-gray-600 dark:text-gray-400">Tokens</h4>
            <p className="text-2xl font-bold">{stats.tokenCount}</p>
          </div>
          {stats.topToken && (
            <div className="col-span-2">
              <h4 className="text-sm text-gray-600 dark:text-gray-400">Top Token</h4>
              <p className="text-xl font-bold">{stats.topToken.symbol}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ${stats.topToken.value.toFixed(2)} ({((stats.topToken.value / stats.totalValue) * 100).toFixed(1)}%)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Token List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-medium mb-4">Token Holdings</h3>
        <div className="space-y-4">
          {tokens.map((token) => (
            <div
              key={token.token}
              className="flex items-center justify-between p-3 border rounded-lg dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              <div>
                <p className="font-medium">{token.symbol}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {token.balance.toFixed(6)} tokens
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">${token.value.toFixed(2)}</p>
                <p className={`text-sm ${token.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {token.change24h.toFixed(2)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}