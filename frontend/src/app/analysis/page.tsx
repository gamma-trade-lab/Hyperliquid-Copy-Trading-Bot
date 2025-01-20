'use client';

import { useState, useEffect } from 'react';
import Analysis from '@/components/Analysis'; 
import Chart from '@/components/Chart';
import MarketData from '@/components/MarketData';
import type { ChartConfig, MetricType, TimeFrame, MarketDataProps } from '@/types/market';



export default function AnalysisPage() {
  // State for chart configuration
  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    type: 'line',
    timeframe: '24h',
    metric: 'price',
    data: []
  });

  // State for loading and error handling
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for selected token
  const [selectedToken, setSelectedToken] = useState<string>('SOL');

  // Fetch market data based on configuration
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Construct the API endpoint based on configuration
        const endpoint = `/api/market-data/${selectedToken}?` + new URLSearchParams({
          timeframe: chartConfig.timeframe,
          metric: chartConfig.metric
        });

        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error('Failed to fetch market data');
        }

        const data = await response.json();

        // Transform the data for the chart
        const transformedData = data.map((item: any) => ({
          timestamp: item.timestamp,
          price: parseFloat(item.price),
          volume: parseFloat(item.volume),
          marketCap: parseFloat(item.marketCap)
        }));

        setChartConfig(prev => ({
          ...prev,
          data: transformedData
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
        console.error('Error fetching market data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMarketData();
  }, [selectedToken, chartConfig.timeframe, chartConfig.metric]);

  // Handler for updating chart configuration
  const updateChartConfig = (updates: Partial<ChartConfig>) => {
    setChartConfig(prev => ({
      ...prev,
      ...updates
    }));
  };

  // Handler for token selection
  const handleTokenSelect = (token: string) => {
    setSelectedToken(token);
  };

  // Available timeframes with proper typing
  const timeframes: TimeFrame[] = ['24h', '7d', '30d', '1y'];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Market Analysis</h1>
        {error && (
          <div className="text-red-500 text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <Analysis 
            updateChartConfig={updateChartConfig}
            selectedToken={selectedToken}
            onTokenSelect={handleTokenSelect}
            chartConfig={chartConfig}
          />
        </div>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-semibold">{selectedToken} Chart</h2>
                {isLoading && (
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              <div className="flex space-x-2">
                {timeframes.map((timeframe) => (
                  <button
                    key={timeframe}
                    onClick={() => updateChartConfig({ timeframe })}
                    className={`px-3 py-1 rounded ${
                      chartConfig.timeframe === timeframe
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {timeframe}
                  </button>
                ))}
              </div>
            </div>
            <Chart 
              chartConfig={chartConfig}
              isLoading={isLoading}
            />
          </div>
          <MarketData 
            token={selectedToken}
            metric={chartConfig.metric}
          />
        </div>
      </div>
    </div>
  );
}