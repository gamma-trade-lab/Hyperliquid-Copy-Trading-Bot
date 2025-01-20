'use client';

import { useState, useEffect } from 'react';
import Trading from '@/components/Trading';
import SwapInterface from '@/components/SwapInterface';
import Chart from '@/components/Chart';
import MarketData from '@/components/MarketData';
import { getTokenInfo, executeSwap } from '@/utils/jup';
import logger from '@/utils/logger';

// Define Token type matching your SwapInterface
interface Token {
  address: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

export default function TradingPage() {
  // States
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<string>('SOL');

  // Chart configuration
  const [chartConfig] = useState({
    type: 'line' as const,
    timeframe: '24h' as const,
    metric: 'price' as const,
    data: []
  });

  // Fetch available tokens
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        setLoading(true);
        
        // Default tokens we want to support
        const defaultTokens = [
          'So11111111111111111111111111111111111111112', // SOL
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
          '8hVzPgFopqEQmNNoghr5WbPY1LEjW8GzgbLRwuwHpump' // JENNA
        ];

        const tokens: Token[] = [];

        // Fetch token info for each token
        for (const address of defaultTokens) {
          try {
            const info = await getTokenInfo(address);
            if (info) {
              tokens.push({
                address, 
                symbol: info.symbol, // Update this line
                decimals: 9, // Default to 9 for SOL tokens
                logoURI: undefined
              });
            }
          } catch (err) {
            logger.error(`Error fetching token info for ${address}:`, err);
          }
        }

        setTokens(tokens);
        
      } catch (err) {
        logger.error('Error fetching tokens:', err);
        setError('Failed to load tokens');
      } finally {
        setLoading(false);
      }
    };

    fetchTokens();
  }, []);

  // Handle swap function
  const handleSwap = async (params: {
    inputToken: Token;
    outputToken: Token;
    amount: string;
    slippage: number;
  }): Promise<string> => {
    try {
      setLoading(true);
      setError(null);

      // Execute the swap
      const txHash = await executeSwap(
        params.inputToken.symbol,
        params.outputToken.symbol,
        Number(params.amount),
        params.outputToken.address
      );

      // Return transaction hash
      return txHash;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Swap failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Trading</h1>
      
      {/* Show error if any */}
      {error && (
        <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <SwapInterface 
            tokens={tokens}
            onSwap={handleSwap}
            loading={loading}
            error={error}
          />
          <MarketData 
            token={selectedToken}
            metric="price"
          />
        </div>
        <div className="space-y-6">
          <Chart 
            chartConfig={chartConfig}
            isLoading={loading}
          />
          <Trading />
        </div>
      </div>
    </div>
  );
}