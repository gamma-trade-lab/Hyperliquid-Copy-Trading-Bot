import React from "react";
import {
  LineChart,
  BarChart,
  PieChart,
  AreaChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  Bar,
  Pie,
  Area,
  ResponsiveContainer,
} from "recharts";

type ChartType = "line" | "bar" | "pie" | "area";

interface DataPoint {
  [key: string]: string | number;
}

interface BaseChartConfig {
  type: ChartType;
  data: DataPoint[];
  xKey: string;
  yKey: unknown;
  dataKey: unknown;
}

interface XYChartConfig extends BaseChartConfig {
  type: "line" | "bar" | "area";
  yKey: string;
}

interface PieChartConfig extends BaseChartConfig {
  type: "pie";
  dataKey: string;
}

type ChartConfig = XYChartConfig | PieChartConfig;

const ChartRenderer = ({ chartConfig }: { chartConfig: ChartConfig }) => {
  const { type, data, xKey, yKey, dataKey } = chartConfig;

  const renderChart = () => {
    switch (type) {
      case "line":
        return (
          <LineChart data={data}>
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey={yKey} stroke="#8884d8" />
          </LineChart>
        );
      case "bar":
        return (
          <BarChart data={data}>
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey={yKey} fill="#8884d8" />
          </BarChart>
        );
      case "pie":
        return (
          <PieChart>
            <Pie
              data={data}
              dataKey={dataKey}
              nameKey={xKey}
              fill="#8884d8"
              label
            />
            <Tooltip />
            <Legend />
          </PieChart>
        );
      case "area":
        return (
          <AreaChart data={data}>
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey={yKey}
              stroke="#8884d8"
              fill="#8884d8"
            />
          </AreaChart>
        );
      default:
        return <div>Unsupported chart type</div>;
    }
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      {renderChart()}
    </ResponsiveContainer>
  );
};

export default ChartRenderer;