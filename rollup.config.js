import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'es',
    sourcemap: true,
    preserveModules: true,
    preserveModulesRoot: 'src',
    interop: 'auto'
  },
  plugins: [
    resolve({
      preferBuiltins: true,
      exportConditions: ['node'],
      extensions: ['.js', '.ts', '.json', '.node'],
      moduleDirectories: ['node_modules']
    }),
    commonjs({
      ignoreDynamicRequires: true,
      requireReturnsDefault: 'auto',
      transformMixedEsModules: true,
      // Handle specific packages
      ignore: [
        '@anush008/tokenizers-linux-x64-gnu',
        /native\-modules/
      ]
    }),
    json(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: 'dist/types',
      rootDir: 'src',
      moduleResolution: 'node'
    })
  ],
  external: [
    'discord.js',
    '@solana/web3.js',
    '@solana/spl-token',
    'dotenv',
    'twitter-api-v2',
    'groq-sdk',
    'undici',
    '@ai16z/eliza',
    '@opentelemetry/api',
    /\.node$/
  ],
  onwarn(warning, warn) {
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    if (warning.code === 'THIS_IS_UNDEFINED') return;
    warn(warning);
  }
};