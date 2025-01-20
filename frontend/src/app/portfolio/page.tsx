'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import Portfolio from '@/components/Portfolio';
import { getAssetsByOwner } from '@/tools/helius/get_assets_by_owner';
import logger from '@/utils/logger';

export default function PortfolioPage() {
  const { connected, publicKey } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<any[]>([]);

  useEffect(() => {
    const fetchPortfolio = async () => {
      if (!connected || !publicKey) return;

      try {
        setIsLoading(true);
        setError(null);

        // Fetch assets
        const walletAssets = await getAssetsByOwner(null, publicKey);
        setAssets(walletAssets);

      } catch (err) {
        logger.error('Error fetching portfolio:', err);
        setError('Failed to load portfolio data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPortfolio();
  }, [connected, publicKey]);

  if (!connected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Portfolio</h1>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center shadow-sm">
          <p className="text-gray-600 dark:text-gray-400">
            Please connect your wallet to view your portfolio
          </p>
          {/* You can add a connect wallet button here if needed */}
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
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Portfolio</h1>
      <Portfolio 
        assets={assets}
      />
    </div>
  );
}