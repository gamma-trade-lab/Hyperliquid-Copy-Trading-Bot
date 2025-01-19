'use client';
import WalletConnect from '../components/WalletConnect';
import { aiService } from '../ai/ai';

import { useState, useEffect } from 'react';
import { Suspense } from 'react';
import { validateApiKey } from '@/utils/groq';
import logger from '@/utils/logger';
import { useWallet } from '@solana/wallet-adapter-react';

// Components
import ApiKeyModal from '@/components/ApiKeyModal';
import Chat from '@/components/Chat';
import { agentWallet } from '@/utils/wallet';
 
// Constants
const STORAGE_KEYS = {
  API_KEY: 'jenna_api_key',
  WALLET_CONNECTED: 'jenna_wallet_connected'
} as const;

export default function Home() {
  const { connected } = useWallet();

  // State
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [hasValidApiKey, setHasValidApiKey] = useState(false);
  const [isWalletInitialized, setIsWalletInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [priceAnalysis, setPriceAnalysis] = useState<string | null>(null);

  // Check API key and initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        setIsLoading(true);

        // Check for existing API key
        const storedApiKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
        if (storedApiKey) {
          const isValid = await validateApiKey(storedApiKey);
          setHasValidApiKey(isValid);
          setIsApiKeyModalOpen(!isValid);
        } else {
          setIsApiKeyModalOpen(true);
        }

        // Initialize wallet
        try {
          const walletConnected = await agentWallet.initialize();
          setIsWalletInitialized(walletConnected);
          localStorage.setItem(STORAGE_KEYS.WALLET_CONNECTED, String(walletConnected));
          logger.success('Services initialized successfully');
        } catch (error) {
          console.error('Wallet initialization error:', error);
          setIsWalletInitialized(false);
          logger.warn('Services initialization partial or failed');
        }

      } catch (error) {
        console.error('Service initialization error:', error);
        setIsApiKeyModalOpen(true);
        logger.error('Services initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeServices();
  }, []);

  // Handle API key submission
  const handleApiKeySubmit = async (apiKey: string) => {
    try {
      const isValid = await validateApiKey(apiKey);
      
      if (isValid) {
        localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey);
        setHasValidApiKey(true);
        setIsApiKeyModalOpen(false);
      } else {
        throw new Error('Invalid API key');
      }
    } catch (error) {
      console.error('API key validation error:', error);
      setHasValidApiKey(false);
    }
  };

  // Handle modal close
  const handleModalClose = () => {
    if (hasValidApiKey) {
      setIsApiKeyModalOpen(false);
    }
  };

  // Handle wallet connect
  const handleWalletConnect = (address: string) => {
    setWalletAddress(address);
  };

  // Handle wallet disconnect
  const handleWalletDisconnect = () => {
    setWalletAddress(null);
    setPriceAnalysis(null);
  };

  // Fetch and analyze price
  const fetchAndAnalyzePrice = async (tokenAddress: string) => {
    try {
      const analysis = await aiService.fetchAndAnalyzePrice(tokenAddress);
      setPriceAnalysis(analysis);
    } catch (error) {
      logger.error('Error fetching and analyzing price:', error);
      setPriceAnalysis('Error fetching and analyzing price. Please try again.');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Initializing JENNA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="container mx-auto px-4 py-8">
        {/* Main Heading - Keep only one */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            JENNA - Solana Trading Assistant
          </h1>
          
          {/* Wallet Status Indicator */}
          <div className="flex items-center gap-2">
            {connected ? (
              <span className="inline-flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                <span className="text-sm text-gray-600 dark:text-gray-300">Wallet Connected</span>
              </span>
            ) : null}
          </div>
        </div>

        <WalletConnect 
          onConnect={handleWalletConnect}
          onDisconnect={handleWalletDisconnect}
        />

        {walletAddress && (
          <div className="mt-8">
            <button
              onClick={() => fetchAndAnalyzePrice(walletAddress)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg"
            >
              Fetch and Analyze Price
            </button>
            {priceAnalysis && (
              <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <pre className="text-sm text-gray-800 dark:text-gray-200">{priceAnalysis}</pre>
              </div>
            )}
          </div>
        )}

        <Suspense 
          fallback={
            <div className="flex justify-center items-center h-64">
              <div className="animate-pulse text-gray-600 dark:text-gray-300">
                Loading Chat...
              </div>
            </div>
          }
        >
          {hasValidApiKey && <Chat />}
        </Suspense>

        <ApiKeyModal 
          isOpen={isApiKeyModalOpen}
          onClose={handleModalClose}
          onApiKeySubmit={handleApiKeySubmit}
        />
      </main>
    </div>
  );
}