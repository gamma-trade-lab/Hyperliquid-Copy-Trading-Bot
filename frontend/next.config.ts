import type { Configuration as WebpackConfig } from 'webpack';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack: (config: WebpackConfig, { isServer }: { isServer: boolean }) => {
    config.module = config.module || { rules: [] };
    config.module.rules = config.module.rules || [];

    if (isServer) {
      config.module.rules.push({
        test: /\.node$/,
        use: 'node-loader',
      });
    } else {
      config.resolve = {
        ...config.resolve,
        fallback: {
          fs: false,
          path: false,
          crypto: false,
        }
      };
    }
    return config;
  }
};

export default nextConfig;