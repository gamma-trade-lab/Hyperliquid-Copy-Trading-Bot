import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, BarChart, Bar } from 'recharts';
import { format } from 'date-fns';

interface ChartData {
  timestamp: number;
  price: number;
  volume: number;
  marketCap: number;
}

interface ChartConfig {
  type: 'line' | 'area' | 'bar';
  timeframe: '24h' | '7d' | '30d' | '1y';
  metric: 'price' | 'volume' | 'marketCap';
  data: ChartData[];
}

interface ChartProps {
  chartConfig: ChartConfig;
  isLoading?: boolean;
}

const Chart: React.FC<ChartProps> = ({ chartConfig, isLoading }) => {
  // Format timestamp based on timeframe
  const formatXAxis = (timestamp: number) => {
    switch (chartConfig.timeframe) {
      case '24h':
        return format(timestamp, 'HH:mm');
      case '7d':
        return format(timestamp, 'EEE');
      case '30d':
        return format(timestamp, 'MMM d');
      case '1y':
        return format(timestamp, 'MMM');
      default:
        return format(timestamp, 'MMM d');
    }
  };

  // Format value based on metric
  const formatValue = (value: number) => {
    switch (chartConfig.metric) {
      case 'price':
        return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'volume':
        return `$${(value / 1000000).toLocaleString()}M`;
      case 'marketCap':
        return `$${(value / 1000000000).toLocaleString()}B`;
      default:
        return value.toLocaleString();
    }
  };

  // Get min and max values for the Y axis
  const getYDomain = () => {
    if (!chartConfig.data.length) return [0, 0];
    const values = chartConfig.data.map(d => d[chartConfig.metric]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.1;
    return [min - padding, max + padding];
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // No data state
  if (!chartConfig.data.length) {
    return (
      <div className="h-[400px] flex items-center justify-center text-gray-500">
        No data available
      </div>
    );
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded shadow-lg border dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">
            {formatXAxis(label)}
          </p>
          <p className="font-semibold text-purple-500">
            {formatValue(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  // Render appropriate chart type
  const renderChart = () => {
    const commonProps = {
      data: chartConfig.data,
      margin: { top: 10, right: 30, left: 0, bottom: 0 }
    };

    switch (chartConfig.type) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatXAxis}
              minTickGap={30}
            />
            <YAxis
              domain={getYDomain()}
              tickFormatter={formatValue}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey={chartConfig.metric}
              stroke="#8B5CF6"
              fillOpacity={1}
              fill="url(#colorMetric)"
            />
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatXAxis}
              minTickGap={30}
            />
            <YAxis
              domain={getYDomain()}
              tickFormatter={formatValue}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey={chartConfig.metric}
              fill="#8B5CF6"
              opacity={0.8}
            />
          </BarChart>
        );

      default: // Line chart
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatXAxis}
              minTickGap={30}
            />
            <YAxis
              domain={getYDomain()}
              tickFormatter={formatValue}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey={chartConfig.metric}
              stroke="#8B5CF6"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        );
    }
  };

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
};

export default Chart;