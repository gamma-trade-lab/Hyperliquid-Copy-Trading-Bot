'use client';
import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';

import { agentWallet } from '@/utils/wallet';
import { getAssetsByOwner } from '@/tools/helius/get_assets_by_owner';
import { getTokenInfo } from '@/utils/jup';
import { getRecentTransactions } from '@/tools/helius/get_recent_transactions';
import { SolanaAgentKit } from "solana-agent-kit";
import logger from '@/utils/logger';

interface WalletAsset {
  mint: string;
  symbol: string;
  amount: number;
  value: number;
  price: number;
}

interface WalletTransaction {
  signature: string;
  type: string;
  amount: number;
  timestamp: string;
  status: 'success' | 'error' | 'pending';
}

interface WalletConnectProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export default function WalletConnect({
  onConnect,
  onDisconnect,
  onError
}: WalletConnectProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [assets, setAssets] = useState<WalletAsset[]>([]);
  const [recentTxs, setRecentTxs] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkWalletConnection();
  }, []);

  useEffect(() => {
    if (isConnected && walletAddress) {
      loadWalletData();
    }
  }, [isConnected, walletAddress]);

  const checkWalletConnection = async () => {
    try {
      const initialized = await agentWallet.initialize();
      setIsConnected(initialized);
      if (initialized) {
        const address = await agentWallet.getAddress();
        setWalletAddress(address);
        onConnect?.(address);
      }
    } catch (error) {
      handleError(error);
    }
  };

  const loadWalletData = async () => {
    if (!walletAddress) return;

    setIsLoading(true);
    try {
      await Promise.all([
        loadBalance(),
        loadAssets(),
        loadTransactions()
      ]);
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBalance = async () => {
    try {
      const { balance: walletBalance } = await agentWallet.getBalance();
      setBalance(walletBalance);
    } catch (error) {
      logger.error('Error loading balance:', error);
    }
  };

  const loadAssets = async () => {
    try {
      if (!walletAddress) return;

      const publicKey = new PublicKey(walletAddress);
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || '';
      const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';

      if (!rpcUrl || !heliusApiKey) {
        throw new Error('Invalid RPC URL or Helius API key');
      }

      const agent = new SolanaAgentKit(
        process.env.NEXT_PUBLIC_PRIVATE_KEY || '',
        rpcUrl,
        heliusApiKey
      );
      const walletAssets = await getAssetsByOwner(agent, publicKey);

      const assetsWithPrices = await Promise.all(
        walletAssets.map(async (asset: { mint: string; symbol: any; amount: any; decimals: any; }) => {
          try {
            const tokenInfo = await getTokenInfo(asset.mint);
            return {
              mint: asset.mint,
              symbol: asset.symbol || 'Unknown',
              amount: Number(asset.amount) / Math.pow(10, asset.decimals || 0),
              price: tokenInfo?.coingeckoData?.price || 0,
              value: (Number(asset.amount) / Math.pow(10, asset.decimals || 0)) * 
                    (tokenInfo?.coingeckoData?.price || 0)
            };
          } catch (error) {
            console.error(`Error getting token info for ${asset.mint}:`, error);
            return {
              mint: asset.mint,
              symbol: asset.symbol || 'Unknown',
              amount: Number(asset.amount) / Math.pow(10, asset.decimals || 0),
              price: 0,
              value: 0
            };
          }
        })
      );

      setAssets(assetsWithPrices);
    } catch (error) {
      console.error('Error loading assets:', error);
      setAssets([]);
    }
  };

  const loadTransactions = async () => {
    try {
      if (!walletAddress) return;
      const txs = await getRecentTransactions(walletAddress);
      const formattedTxs: WalletTransaction[] = txs.map(tx => ({
        signature: tx.signature,
        type: tx.type,
        amount: tx.amount ?? 0,
        timestamp: tx.timestamp,
        status: tx.status as 'success' | 'error' | 'pending'
      }));
      setRecentTxs(formattedTxs);
    } catch (error) {
      logger.error('Error loading transactions:', error);
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const initialized = await agentWallet.initialize();
      if (initialized) {
        const address = await agentWallet.getAddress();
        setIsConnected(true);
        setWalletAddress(address);
        onConnect?.(address);
      } else {
        throw new Error('Failed to initialize wallet');
      }
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsConnected(false);
      setWalletAddress(null);
      setBalance(null);
      setAssets([]);
      setRecentTxs([]);
      onDisconnect?.();
    } catch (error) {
      handleError(error);
    }
  };

  const handleError = (error: any) => {
    const message = error instanceof Error ? error.message : 'An error occurred';
    setError(message);
    onError?.(error instanceof Error ? error : new Error(message));
  };

  return (
    <div className="space-y-6">
      {/* Wallet Connection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded">
            {error}
          </div>
        )}

        <div className="flex justify-between items-center">
          <div>
            {isConnected && walletAddress ? (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Connected Wallet
                </p>
                <p className="font-mono text-sm">
                  {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                </p>
                {balance !== null && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Balance: {balance.toFixed(4)} SOL
                  </p>
                )}
              </div>
            ) : (
              // Removed "No wallet connected" message
              null
            )}
          </div>

          <button
            onClick={isConnected ? handleDisconnect : handleConnect}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg font-medium ${
              isConnected
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-purple-500 text-white hover:bg-purple-600'
            } disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200`}
          >
            {isLoading ? 'Loading...' : isConnected ? 'Disconnect' : 'Connect'}
          </button>
        </div>
      </div>

      {/* Assets and Transactions sections remain the same */}
      {/* Reuse the existing JSX for assets and transactions */}
      {isConnected && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-medium mb-4">Assets</h3>
          <div className="space-y-3">
            {assets.map((asset) => (
              <div
                key={asset.mint}
                className="flex justify-between items-center p-3 border rounded-lg dark:border-gray-700"
              >
                <div>
                  <p className="font-medium">{asset.symbol}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {asset.amount.toFixed(4)} tokens
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    ${(asset.amount * asset.price).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    ${asset.price.toFixed(6)} per token
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isConnected && recentTxs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-medium mb-4">Recent Transactions</h3>
          <div className="space-y-3">
            {recentTxs.map((tx) => (
              <div
                key={tx.signature}
                className="flex justify-between items-center p-3 border rounded-lg dark:border-gray-700"
              >
                <div>
                  <p className="font-medium">{tx.type}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(tx.timestamp).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {tx.amount.toFixed(4)} SOL
                  </p>
                  <p className={`text-sm ${
                    tx.status === 'success'
                      ? 'text-green-500'
                      : tx.status === 'error'
                      ? 'text-red-500'
                      : 'text-yellow-500'
                  }`}>
                    {tx.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}