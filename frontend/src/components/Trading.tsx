'use client';

import { useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import SwapInterface from './SwapInterface';
import { getSwapQuote, executeSwap, fetchJupiterTokens } from '@/utils/jup';
import logger from '@/utils/logger';
import dynamic from 'next/dynamic';

// Dynamically import wallet components with ssr disabled
const WalletButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
);

// Types
interface Token {
  address: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

interface TradeState {
  inputToken: Token | null;
  outputToken: Token | null;
  inputAmount: string;
  outputAmount: string;
  slippage: number;
  route: any | null;
  loading: boolean;
  error: string | null;
}

interface Trade {
  signature: string;
  timestamp: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
}

const INITIAL_STATE: TradeState = {
  inputToken: null,
  outputToken: null,
  inputAmount: '',
  outputAmount: '',
  slippage: 1.0,
  route: null,
  loading: false,
  error: null
};

// Default tokens with unique identifiers
const DEFAULT_TOKENS: Token[] = [
  {
    address: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    decimals: 9,
    logoURI: '/solana-logo.png'
  },
  {
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    decimals: 6,
    logoURI: '/usdc-logo.png'
  },
  {
    address: '8hVzPgFopqEQmNNoghr5WbPY1LEjW8GzgbLRwuwHpump',
    symbol: 'JENNA',
    decimals: 9,
    logoURI: '/jenna-logo.png'
  }
];

export default function Trading() {
  const [state, setState] = useState<TradeState>(INITIAL_STATE);
  const [tokens, setTokens] = useState<Token[]>(DEFAULT_TOKENS);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [connection] = useState(
    () => new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com')
  );

  // Handle client-side hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      loadTokens();
    }
  }, [isClient]);

  const loadTokens = async () => {
    try {
      const additionalTokens = await fetchJupiterTokens();
      
      // Merge tokens avoiding duplicates by address
      const tokenMap = new Map<string, Token>();
      
      // Add default tokens first
      DEFAULT_TOKENS.forEach(token => {
        tokenMap.set(token.address, token);
      });
      
      // Add additional tokens, skipping duplicates
      additionalTokens.forEach((token: Token) => {
        if (!tokenMap.has(token.address)) {
          tokenMap.set(token.address, token);
        }
      });

      setTokens(Array.from(tokenMap.values()));
    } catch (error) {
      logger.error('Error loading tokens:', error);
    }
  };

  const handleSwap = async (params: {
    inputToken: Token;
    outputToken: Token;
    amount: string;
    slippage: number;
  }): Promise<string> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const quote = await getSwapQuote(Number(params.amount), params.outputToken.address);

      if (!quote) {
        throw new Error('Failed to get quote');
      }

      const txHash = await executeSwap(params.inputToken.symbol, params.outputToken.symbol, Number(params.amount), params.outputToken.address);

      const trade: Trade = {
        signature: txHash,
        timestamp: new Date().toISOString(),
        inputToken: params.inputToken.symbol,
        outputToken: params.outputToken.symbol,
        inputAmount: params.amount,
        outputAmount: quote.outAmount
      };

      setRecentTrades(prev => [trade, ...prev].slice(0, 5));

      return txHash;

    } catch (error) {
      logger.error('Swap error:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Swap failed'
      }));
      throw error;
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  if (!isClient) {
    return null; // Prevent hydration mismatch
  }

  return (
    <div className="space-y-6">
      <SwapInterface
        tokens={tokens}
        onSwap={handleSwap}
        loading={state.loading}
        error={state.error}
      />

      {recentTrades.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-medium mb-4">Recent Trades</h3>
          <div className="space-y-3">
            {recentTrades.map((trade) => (
              <div
                key={trade.signature}
                className="p-3 border rounded-lg dark:border-gray-700"
              >
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {trade.inputToken} → {trade.outputToken}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      <a
                        href={`https://solscan.io/tx/${trade.signature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-purple-500"
                      >
                        {new Date(trade.timestamp).toLocaleString()}
                      </a>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      {trade.inputAmount} {trade.inputToken}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {trade.outputAmount} {trade.outputToken}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}