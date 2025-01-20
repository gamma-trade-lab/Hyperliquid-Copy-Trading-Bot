// TransactionView.tsx
import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';

import { getAssetsByOwner } from '@/tools/helius/get_assets_by_owner';
import * as validation from '@/utils/validation';
import { SolanaAgentKit } from 'solana-agent-kit';
import { getRecentTransactions } from '@/tools/helius/get_recent_transactions'; 
import logger from '@/utils/logger';

interface Transaction {
  signature: string;
  timestamp: string;
  status: 'success' | 'error' | 'pending';
  type: string;
  amount?: number;
  token?: string;
  from: string;
  to: string;
}

interface Asset {
  mint: string;
  name: string;
  symbol: string;
  amount: number;
  tokenAccount: string;
}

interface TransactionViewProps {
  walletAddress?: string;
  onTransactionSubmit?: (signature: string) => void;
  onError?: (error: Error) => void;
}

export function TransactionView({ 
  walletAddress,
  onTransactionSubmit,
  onError 
}: TransactionViewProps) {
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (walletAddress) {
      loadWalletData();
    }
  }, [walletAddress]);

  const loadWalletData = async () => {
    if (!walletAddress || !validation.validateSolanaAddress(walletAddress)) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [walletTransactions, walletAssets] = await Promise.all([
        getRecentTransactions(walletAddress), // Correctly call the function
        loadAssets(walletAddress)
      ]);

      setRecentTransactions(walletTransactions); // Properly set the state
      setAssets(walletAssets);
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAssets = async (address: string) => {
    try {
      const publicKey = new PublicKey(address);
      const agent = new SolanaAgentKit(
        process.env.NEXT_PUBLIC_SOLANA_PRIVATE_KEY || '',
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL || '',
        process.env.NEXT_PUBLIC_SOLANA_API_KEY || ''
      );
      const assets = await getAssetsByOwner(agent, publicKey, 100);
      return assets.map((asset: { mint: any; name: any; symbol: any; amount: any; tokenAccount: any; }) => ({
        mint: asset.mint,
        name: asset.name,
        symbol: asset.symbol,
        amount: asset.amount,
        tokenAccount: asset.tokenAccount
      }));
    } catch (error) {
      logger.error('Error loading assets:', error);
      throw error;
    }
  };

  const handleSendTransaction = async () => {
    if (!validation.validateSolanaAddress(recipientAddress)) {
      setError('Invalid recipient address');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const parsedAmount = parseFloat(amount);
      if (!validation.validateSolanaAmount(parsedAmount)) {
        throw new Error('Invalid amount');
      }

      const response = await fetch('/api/wallet/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: recipientAddress,
          amount: parsedAmount,
          rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send transaction');
      }

      const result = await response.json();
      onTransactionSubmit?.(result.signature);
      await loadWalletData();
      clearForm();
    } catch (error) {
      handleError(error);
    } finally {
      setIsSending(false);
    }
  };

  const handleError = (error: any) => {
    const message = error instanceof Error ? error.message : 'An error occurred';
    setError(message);
    onError?.(error instanceof Error ? error : new Error(message));
  };

  const clearForm = () => {
    setRecipientAddress('');
    setAmount('');
    setSelectedAsset(null);
  };

  if (!walletAddress) {
    return (
      <div className="text-center text-gray-600 dark:text-gray-400">
        Please connect your wallet to view transactions
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Send Transaction Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <h3 className="text-lg font-medium mb-4">Send Transaction</h3>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Asset
            </label>
            <select
              value={selectedAsset?.mint || ''}
              onChange={(e) => {
                const asset = assets.find(a => a.mint === e.target.value);
                setSelectedAsset(asset || null);
              }}
              className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">SOL</option>
              {assets.map((asset) => (
                <option key={asset.mint} value={asset.mint}>
                  {asset.symbol} ({asset.amount})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Recipient
            </label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="Recipient address"
              className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              min="0"
              step="0.000000001"
              className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <button
            onClick={handleSendTransaction}
            disabled={isSending || !amount || !recipientAddress}
            className="w-full py-2 bg-purple-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-600 transition-colors duration-200"
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <h3 className="text-lg font-medium mb-4">Recent Transactions</h3>
        
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        ) : recentTransactions.length > 0 ? (
          <div className="space-y-4">
            {recentTransactions.map((tx) => (
              <div
                key={tx.signature}
                className="p-3 border rounded-lg dark:border-gray-700"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium">
                      {tx.type}{' '}
                      <span className={
                        tx.status === 'success' ? 'text-green-500' :
                        tx.status === 'error' ? 'text-red-500' :
                        'text-yellow-500'
                      }>
                        • {tx.status}
                      </span>
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {new Date(tx.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {tx.amount && `${tx.amount} ${tx.token || 'SOL'}`}
                    </p>
                    <a
                      href={`https://solscan.io/tx/${tx.signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-purple-500 hover:text-purple-600"
                    >
                      View on Solscan
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-600 dark:text-gray-400">
            No recent transactions
          </div>
        )}
      </div>
    </div>
  );
}