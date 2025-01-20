'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Portfolio from '@/components/Portfolio';
import { getAssetsByOwner } from '@/tools/helius/get_assets_by_owner';
import { SolanaAgentKit } from 'solana-agent-kit';
import logger from '@/utils/logger';
import type { Asset } from '@/types/portfolio'; 

export default function PortfolioPage() {
  const { connected, publicKey } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    const fetchPortfolio = async () => {
      if (!connected || !publicKey) return;

      try {
        setIsLoading(true);
        setError(null);

        // Initialize SolanaAgentKit
        const agent = new SolanaAgentKit(
          process.env.NEXT_PUBLIC_PRIVATE_KEY || '',
          process.env.NEXT_PUBLIC_RPC_URL || '',
          'confirmed'
        );

        // Fetch assets with proper types
        const walletAssets = await getAssetsByOwner(agent, publicKey);
        
        // Transform assets to match Asset type if needed
        const formattedAssets = walletAssets.map((asset: any) => ({
          symbol: asset.symbol || '',
          name: asset.name || '',
          amount: parseFloat(asset.amount) || 0,
          amountLamports: asset.amountLamports || 0,
          priceUSD: asset.priceUSD || '0',
          valueUSD: parseFloat(asset.valueUSD) || 0,
          decimals: asset.decimals || 0,
          address: asset.address || ''
        }));

        setAssets(formattedAssets);
      } catch (err) {
        logger.error('Error fetching portfolio:', err);
        setError('Failed to load portfolio data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    if (connected && publicKey) {
      fetchPortfolio();
    } else {
      // Reset state when wallet disconnects
      setAssets([]);
      setError(null);
    }
  }, [connected, publicKey]);

  const handleRetry = () => {
    if (connected && publicKey) {
      setError(null);
      setAssets([]);
      // Re-trigger the useEffect
      const fetchPortfolio = async () => {
        // ... same code as above
      };
      fetchPortfolio();
    }
  };

  const handleError = (err: Error) => {
    logger.error('Portfolio component error:', err);
    setError(err.message);
  };

  if (!connected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Portfolio</h1>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center shadow-sm">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Connect your wallet to view your portfolio
          </p>
          <WalletMultiButton className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded" />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Portfolio</h1>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-sm">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Portfolio</h1>
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button 
            onClick={handleRetry}
            className="bg-red-100 dark:bg-red-800 text-red-600 dark:text-red-200 px-4 py-2 rounded-lg hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Portfolio</h1>
        <button
          onClick={handleRetry}
          className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          Refresh
        </button>
      </div>
      
      {assets.length > 0 ? (
        <Portfolio
          walletAddress={publicKey!.toString()}
          assets={assets}
          onError={handleError}
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center shadow-sm">
          <p className="text-gray-600 dark:text-gray-400">
            No assets found in this wallet
          </p>
        </div>
      )}
    </div>
  );
}