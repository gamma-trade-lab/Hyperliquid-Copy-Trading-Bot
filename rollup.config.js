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
    sourcemap: true
  },
  plugins: [
    resolve({
      preferBuiltins: true,
      exportConditions: ['node'],
      extensions: ['.js', '.ts']
    }),
    commonjs(),
    json(),
    typescript({
      tsconfig: './tsconfig.json',
      paths: {
        '@/*': [path.resolve(__dirname, './src/*')]
      }
    })
  ],
  external: [
    'discord.js',
    '@solana/web3.js',
    '@solana/spl-token',
    'twitter-api-v2',
    'groq-sdk',
    'undici'
  ]
};