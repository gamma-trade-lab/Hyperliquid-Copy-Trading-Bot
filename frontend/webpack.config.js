const path = require('path');

module.exports = {
  // ...existing code...
  module: {
    rules: [
      // ...existing rules...
      {
        test: /\.node$/,
        use: 'node-loader',
      },
      {
        test: /\.(bin|node)$/,
        loader: 'file-loader',
        options: {
          name: '[name].[ext]',
        },
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.node'],
    // ...existing code...
  },
  // ...existing code...
};
