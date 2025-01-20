//SwapInterface.tsx
import { useState, useEffect } from 'react';
import { getSwapQuote, executeSwap } from '@/utils/jup'; // Correct import
import logger from '@/utils/logger';


interface Token {
  address: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

interface SwapInterfaceProps {
  tokens: Token[];
  onSwap: (params: {
    inputToken: Token;
    outputToken: Token;
    amount: string;
    slippage: number;
  }) => Promise<string>;
  loading?: boolean;
  error?: string | null;
}

export default function SwapInterface({
  tokens,
  onSwap,
  loading = false,
  error = null
}: SwapInterfaceProps) {
  const [inputToken, setInputToken] = useState<Token | null>(null);
  const [outputToken, setOutputToken] = useState<Token | null>(null);
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [slippage, setSlippage] = useState(1.0);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Get quote when input changes
  useEffect(() => {
    const getQuote = async () => {
      if (!inputToken || !outputToken || !inputAmount || Number(inputAmount) <= 0) {
        setOutputAmount('');
        return;
      }

      setQuoteLoading(true);
      try {
        const quote = await getSwapQuote(Number(inputAmount), outputToken.address); // Correct function usage

        if (quote) {
          setOutputAmount(quote.outAmount);
        }
      } catch (error) {
        logger.error('Error getting quote:', error);
        setOutputAmount('');
      } finally {
        setQuoteLoading(false);
      }
    };

    getQuote();
  }, [inputToken, outputToken, inputAmount, slippage]);

  const handleSwap = async () => {
    if (!inputToken || !outputToken || !inputAmount) return;

    try {
      const result = await executeSwap(inputToken.symbol, outputToken.symbol, Number(inputAmount), outputToken.address);

      // Clear form
      setInputAmount('');
      setOutputAmount('');
    } catch (error) {
      logger.error('Swap error:', error);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
      <h3 className="text-lg font-medium mb-4">Swap Tokens</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Input Token */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            From
          </label>
          <div className="flex gap-2">
            <select
              value={inputToken?.address || ''}
              onChange={(e) => {
                const token = tokens.find(t => t.address === e.target.value);
                setInputToken(token || null);
              }}
              className="flex-1 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">Select token</option>
              {tokens.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>

        {/* Swap Direction */}
        <button
          onClick={() => {
            const temp = inputToken;
            setInputToken(outputToken);
            setOutputToken(temp);
            setInputAmount(outputAmount);
            setOutputAmount(inputAmount);
          }}
          className="mx-auto block p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>

        {/* Output Token */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            To
          </label>
          <div className="flex gap-2">
            <select
              value={outputToken?.address || ''}
              onChange={(e) => {
                const token = tokens.find(t => t.address === e.target.value);
                setOutputToken(token || null);
              }}
              className="flex-1 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">Select token</option>
              {tokens.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={outputAmount}
              readOnly
              placeholder={quoteLoading ? 'Loading...' : '0.00'}
              className="flex-1 p-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>

        {/* Slippage Setting */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Slippage Tolerance
          </label>
          <div className="flex gap-2">
            {[0.5, 1.0, 2.0].map((value) => (
              <button
                key={value}
                onClick={() => setSlippage(value)}
                className={`px-3 py-1 rounded-lg ${
                  slippage === value
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {value}%
              </button>
            ))}
            <input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(Number(e.target.value))}
              className="w-20 p-1 border rounded-lg text-center dark:bg-gray-700 dark:border-gray-600"
              min="0.1"
              max="50"
              step="0.1"
            />
          </div>
        </div>

        {/* Swap Button */}
        <button
          onClick={handleSwap}
          disabled={loading || !inputToken || !outputToken || !inputAmount || Number(inputAmount) <= 0}
          className="w-full py-3 bg-purple-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-600 transition-colors duration-200"
        >
          {loading ? 'Swapping...' : 'Swap'}
        </button>
      </div>
    </div>
  );
}