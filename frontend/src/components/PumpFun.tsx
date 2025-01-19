//PumpFun.tsx
import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { elizaLogger } from "@ai16z/eliza";

interface TokenMetrics {
  price: number;
  volume24h: number;
  marketCap: number;
  holders: number;
  supply: number;
}

interface TokenChart {
  timestamp: number;
  price: number;
  volume: number;
}

interface PumpFunProps {
  walletAddress?: string;
  onTransaction?: (signature: string) => void;
  onError?: (error: Error) => void;
}

export default function PumpFun({ walletAddress, onTransaction, onError }: PumpFunProps) {
  const [metrics, setMetrics] = useState<TokenMetrics | null>(null);
  const [chartData, setChartData] = useState<TokenChart[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userBalance, setUserBalance] = useState<number | null>(null);

  const JENNA_TOKEN_ADDRESS = '8hVzPgFopqEQmNNoghr5WbPY1LEjW8GzgbLRwuwHpump';

  useEffect(() => {
    loadTokenData();
    if (walletAddress) {
      loadUserBalance();
    }
  }, [walletAddress]);

  const loadTokenData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Load token metrics from PumpFun API
      const response = await fetch(`https://pump.fun/api/token/${JENNA_TOKEN_ADDRESS}`);
      if (!response.ok) throw new Error('Failed to fetch token data');
      
      const data = await response.json();
      setMetrics({
        price: data.price,
        volume24h: data.volume24h,
        marketCap: data.marketCap,
        holders: data.holders,
        supply: data.supply
      });

      // Load chart data
      const chartResponse = await fetch(
        `https://pump.fun/api/token/${JENNA_TOKEN_ADDRESS}/chart?period=24h`
      );
      if (!chartResponse.ok) throw new Error('Failed to fetch chart data');
      
      const chartData = await chartResponse.json();
      setChartData(chartData);

    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserBalance = async () => {
    try {
      const publicKey = new PublicKey(walletAddress!);
      const tokenPublicKey = new PublicKey(JENNA_TOKEN_ADDRESS);
      
      // Get token account
      const response = await fetch(`/api/wallet/tokens?address=${walletAddress}`);
      if (!response.ok) throw new Error('Failed to fetch token balance');
      
      const data = await response.json();
      const balance = data.tokens.find(
        (t: any) => t.mint === JENNA_TOKEN_ADDRESS
      )?.amount || 0;

      setUserBalance(balance);
    } catch (error) {
      elizaLogger.error('Error loading balance:', error);
    }
  };

  const handleError = (error: any) => {
    const message = error instanceof Error ? error.message : 'An error occurred';
    setError(message);
    onError?.(error instanceof Error ? error : new Error(message));
  };

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
      {/* Token Overview */}
      {metrics && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-medium">JENNA Token</h3>
              <a
                href={`https://pump.fun/token/${JENNA_TOKEN_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-purple-500 hover:text-purple-600"
              >
                View on PumpFun
              </a>
            </div>
            {userBalance !== null && (
              <div className="text-right">
                <p className="text-sm text-gray-600 dark:text-gray-400">Your Balance</p>
                <p className="text-lg font-medium">{userBalance.toLocaleString()} JENNA</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <h4 className="text-sm text-gray-600 dark:text-gray-400">Price</h4>
              <p className="text-2xl font-bold">${metrics.price.toFixed(6)}</p>
            </div>
            <div>
              <h4 className="text-sm text-gray-600 dark:text-gray-400">24h Volume</h4>
              <p className="text-2xl font-bold">${metrics.volume24h.toLocaleString()}</p>
            </div>
            <div>
              <h4 className="text-sm text-gray-600 dark:text-gray-400">Market Cap</h4>
              <p className="text-2xl font-bold">${metrics.marketCap.toLocaleString()}</p>
            </div>
            <div>
              <h4 className="text-sm text-gray-600 dark:text-gray-400">Holders</h4>
              <p className="text-2xl font-bold">{metrics.holders.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Price Chart */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-medium mb-4">Price History</h3>
          <div className="h-64">
            {/* Add your preferred charting library here */}
            {/* Example: Chart.js, Recharts, etc. */}
          </div>
        </div>
      )}

      {/* Token Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-medium mb-4">Token Information</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          The JENNA token is a utility token used within the PumpFun ecosystem. It allows users to participate in various activities and earn rewards.
        </p>
      </div>
    </div>
  );
}