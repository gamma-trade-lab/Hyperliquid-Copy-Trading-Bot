import { useState, useEffect } from 'react';
import parseTransaction from '@/tools/helius/helius_transaction_parsing';
import { ScoringWalletKit } from '@/utils/scoringWallet';
import { PublicKey } from '@solana/web3.js';
import { SolanaAgentKit } from 'solana-agent-kit/dist/agent';
import type  ChartConfig  from './Chart';

interface AnalysisScore {
  category: string;
  score: number;
  description: string;
}

interface WalletMetrics {
  transactionCount: number;
  uniqueDexes: number;
  tradingVolume: number;
  profitability: number;
  avgTransactionSize: number;
}

interface TransactionType {
  type: string;
  count: number;
  volume: number;
}

interface AnalysisProps {
  walletAddress?: string;
  onError?: (error: Error) => void;
  updateChartConfig: (config: Partial<ChartConfig>) => void;
  selectedToken: string;
  onTokenSelect: (token: string) => void;
  chartConfig: ChartConfig;
}

interface ChartData {
  name: string;
  uv: number;
  pv: number;
  amt: number;
}

export interface ChartConfig {
  type: 'line' | 'area' | 'bar';
  timeframe: '24h' | '7d' | '30d' | '1y';
  metric: 'price' | 'volume' | 'marketCap';
  data: Array<{
    timestamp: number;
    price: number;
    volume: number;
    marketCap: number;
  }>;
}

const Analysis: React.FC<AnalysisProps> = ({
  walletAddress,
  onError,
  updateChartConfig,
  selectedToken,
  onTokenSelect,
  chartConfig
}) => {
  const [scores, setScores] = useState<AnalysisScore[]>([]);
  const [metrics, setMetrics] = useState<WalletMetrics | null>(null);
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (walletAddress) {
      analyzeWallet();
    }
  }, [walletAddress]);

  const analyzeWallet = async () => {
    if (!walletAddress) return;

    setIsLoading(true);
    setError(null);

    try {
      // Initialize scoring wallet
      const wallet = new PublicKey(walletAddress);
      await ScoringWalletKit.fetchTx(wallet, 1000); // Analyze last 1000 transactions

      // Get scores
      const analysisScores: AnalysisScore[] = [
        {
          category: 'Transaction Frequency',
          score: ScoringWalletKit.calcTxFreq(),
          description: 'Measures trading activity frequency'
        },
        {
          category: 'Volume',
          score: ScoringWalletKit.calcVol(),
          description: 'Trading volume score'
        },
        {
          category: 'Profitability',
          score: ScoringWalletKit.calcProfitability(),
          description: 'Success rate of trades'
        },
        {
          category: 'DEX Diversity',
          score: ScoringWalletKit.calcDexDiversity(),
          description: 'Usage of different DEXes'
        },
        {
          category: 'Risk Profile',
          score: ScoringWalletKit.calcRiskContract(),
          description: 'Risk assessment based on trading patterns'
        },
        {
          category: 'Final Score',
          score: ScoringWalletKit.calcFinalScore(),
          description: 'Overall performance score'
        }
      ];

      setScores(analysisScores);

      // Parse transactions
      const privateKey = process.env.SOLANA_PRIVATE_KEY || '';
      const rpcUrl = process.env.SOLANA_RPC_URL || '';
      const openaiApiKey = process.env.OPENAI_API_KEY || '';
      const agent = new SolanaAgentKit(privateKey, rpcUrl, openaiApiKey); // Initialize SolanaAgentKit instance with required arguments
      const txs = await parseTransaction(agent, walletAddress);

      // Calculate metrics
      const metrics: WalletMetrics = {
        transactionCount: txs.length,
        uniqueDexes: new Set(txs.map((tx: { dex: any; }) => tx.dex)).size,
        tradingVolume: txs.reduce((sum: any, tx: { volume: any; }) => sum + (tx.volume || 0), 0),
        profitability: txs.filter((tx: { profit: number; }) => tx.profit > 0).length / txs.length * 100,
        avgTransactionSize: txs.reduce((sum: any, tx: { volume: any; }) => sum + (tx.volume || 0), 0) / txs.length
      };

      setMetrics(metrics);

      // Calculate transaction types
      const typeMap = new Map<string, TransactionType>();
      txs.forEach((tx: { type: string; volume: any; }) => {
        const existing = typeMap.get(tx.type) || { type: tx.type, count: 0, volume: 0 };
        typeMap.set(tx.type, {
          ...existing,
          count: existing.count + 1,
          volume: existing.volume + (tx.volume || 0)
        });
      });

      setTransactionTypes(Array.from(typeMap.values()));

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Analysis failed';
      setError(message);
      onError?.(error instanceof Error ? error : new Error(message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleButtonClick = () => {
    const newConfig: Partial<ChartConfig> = {
      type: 'bar',
      data: chartConfig.data // Keep the existing data
    };
    updateChartConfig(newConfig);
  };

  if (!walletAddress) {
    return (
      <div className="text-center text-gray-600 dark:text-gray-400">
        Connect wallet to view analysis
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
      {/* Score Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-medium mb-4">Wallet Analysis</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {scores.map((score) => (
            <div key={score.category} className="p-4 border rounded-lg dark:border-gray-700">
              <h4 className="text-sm text-gray-600 dark:text-gray-400">
                {score.category}
              </h4>
              <p className="text-2xl font-bold">{score.score.toFixed(2)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {score.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Trading Metrics */}
      {metrics && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-medium mb-4">Trading Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <h4 className="text-sm text-gray-600 dark:text-gray-400">Transactions</h4>
              <p className="text-2xl font-bold">{metrics.transactionCount}</p>
            </div>
            <div>
              <h4 className="text-sm text-gray-600 dark:text-gray-400">DEXes Used</h4>
              <p className="text-2xl font-bold">{metrics.uniqueDexes}</p>
            </div>
            <div>
              <h4 className="text-sm text-gray-600 dark:text-gray-400">Volume</h4>
              <p className="text-2xl font-bold">${metrics.tradingVolume.toFixed(2)}</p>
            </div>
            <div>
              <h4 className="text-sm text-gray-600 dark:text-gray-400">Success Rate</h4>
              <p className="text-2xl font-bold">{metrics.profitability.toFixed(1)}%</p>
            </div>
            <div>
              <h4 className="text-sm text-gray-600 dark:text-gray-400">Avg Tx Size</h4>
              <p className="text-2xl font-bold">${metrics.avgTransactionSize.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Types */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-medium mb-4">Transaction Types</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {transactionTypes.map((type) => (
            <div key={type.type} className="p-4 border rounded-lg dark:border-gray-700">
              <h4 className="text-sm text-gray-600 dark:text-gray-400">{type.type}</h4>
              <p className="text-2xl font-bold">{type.count}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Volume: ${type.volume.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <button onClick={handleButtonClick}>Update Chart</button>
      </div>
    </div>
  );
};

export default Analysis;