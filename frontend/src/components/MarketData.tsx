import { useState, useEffect } from 'react';
import { fetchPrice } from '@/tools/jupiter/fetch_price';

import { getSolanaPrice, getTrendingSolanaTokens } from '@/utils/coingecko';
import { birdeyeTrendingAPI } from '@/tools/birdeye/birdeyeTrendingAPI';
import { PublicKey } from '@solana/web3.js';
import logger from '@/utils/logger';


// Types
interface TokenPrice {
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  lastUpdated: string;
}

interface TrendingToken {
  address: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  liquidity: number;
}

interface MarketDataProps {
  onPriceUpdate?: (price: TokenPrice) => void;
  onError?: (error: Error) => void;
  token: string; // Add this line
  metric: 'price' | 'volume' | 'marketCap'; // Add this line
}

export default function MarketData({ onPriceUpdate, onError }: MarketDataProps) {
  const [solPrice, setSolPrice] = useState<TokenPrice | null>(null);
  const [jennaPrice, setJennaPrice] = useState<TokenPrice | null>(null);
  const [trendingTokens, setTrendingTokens] = useState<TrendingToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch Solana price from CoinGecko
  const fetchSolanaPrice = async () => {
    try {
      const coingeckoData = await getSolanaPrice();
      
      const price: TokenPrice = {
        price: coingeckoData.price,
        change24h: coingeckoData.price_change_24h,
        volume24h: coingeckoData.volume,
        marketCap: coingeckoData.market_cap,
        lastUpdated: new Date().toISOString()
      };

      setSolPrice(price);
      onPriceUpdate?.(price);
      return price;
    } catch (error) {
      logger.error('Error fetching Solana price:', error);
      const e = error instanceof Error ? error : new Error('Price fetch failed');
      onError?.(e);
      throw e;
    }
  };

  // Fetch JENNA token price
  const fetchJennaPrice = async () => {
    try {
      const jennaAddress = '8hVzPgFopqEQmNNoghr5WbPY1LEjW8GzgbLRwuwHpump';
      const jennaPriceData = await fetchPrice(new PublicKey(jennaAddress));
      
      if (!jennaPriceData) throw new Error('No data for JENNA token');

      const priceData = typeof jennaPriceData === 'string' 
        ? { 
            price: parseFloat(jennaPriceData),
            change24h: 0,
            volume24h: 0,
            marketCap: 0
          } 
        : jennaPriceData;
      const price: TokenPrice = {
        price: priceData.price || 0,
        change24h: priceData.change24h || 0,
        volume24h: priceData.volume24h || 0,
        marketCap: priceData.marketCap || 0,
        lastUpdated: new Date().toISOString()
      };

      setJennaPrice(price);
      return price;
    } catch (error) {
      logger.error('Error fetching JENNA price:', error);
      throw error;
    }
  };

  // Fetch trending tokens
  const fetchTrendingTokens = async () => {
    try {
      const birdeyeTokens = await birdeyeTrendingAPI.getTrending();
      const formattedTokens: TrendingToken[] = birdeyeTokens.map(token => ({
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        price: token.price || 0,
        change24h: token.priceChange24h || 0,
        volume24h: token.volume24h || 0,
        liquidity: token.liquidity || 0
      }));
      
      setTrendingTokens(formattedTokens);
      return formattedTokens;
    } catch (error) {
      logger.error('Error fetching trending tokens:', error);
      throw error;
    }
  };

  // Setup initial data fetch and updates
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const fetchData = async () => {
      try {
        await Promise.all([
          fetchSolanaPrice(),
          fetchJennaPrice(),
          fetchTrendingTokens()
        ]);
        setIsLoading(false);
      } catch (error) {
        setError('Failed to update market data');
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchData();

    // Set up interval for updates
    intervalId = setInterval(fetchData, 30000); // Update every 30 seconds

    // Cleanup
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-12 bg-gray-200 rounded dark:bg-gray-700"></div>
        <div className="h-32 bg-gray-200 rounded dark:bg-gray-700"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg text-red-600 dark:text-red-400">
        <p className="font-medium">Error loading market data</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SOL Price Card */}
      {solPrice && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-medium mb-2">Solana Price</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold">${solPrice.price.toFixed(2)}</p>
              <p className={`text-sm ${solPrice.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {solPrice.change24h.toFixed(2)}% (24h)
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Volume: ${(solPrice.volume24h / 1e6).toFixed(2)}M
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                MCap: ${(solPrice.marketCap / 1e9).toFixed(2)}B
              </p>
            </div>
          </div>
        </div>
      )}

      {/* JENNA Price Card */}
      {jennaPrice && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-medium mb-2">JENNA Token</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold">${jennaPrice.price.toFixed(6)}</p>
              <p className={`text-sm ${jennaPrice.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {jennaPrice.change24h.toFixed(2)}% (24h)
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Volume: ${(jennaPrice.volume24h).toFixed(2)}
              </p>
              <a 
                href="https://pump.fun/coin/8hVzPgFopqEQmNNoghr5WbPY1LEjW8GzgbLRwuwHpump"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-purple-500 hover:text-purple-600"
              >
                View on PumpFun
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Trending Tokens */}
      {trendingTokens.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-medium mb-4">Trending Tokens</h3>
          <div className="space-y-4">
            {trendingTokens.map((token) => (
              <div key={token.address} className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{token.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{token.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">${token.price.toFixed(6)}</p>
                  <p className={`text-sm ${token.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {token.change24h.toFixed(2)}%
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