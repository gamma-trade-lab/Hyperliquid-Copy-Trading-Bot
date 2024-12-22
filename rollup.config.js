import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'es',
    sourcemap: true,
    preserveModules: true,
    preserveModulesRoot: 'src'
  },
  plugins: [
    resolve({
      preferBuiltins: true,
      exportConditions: ['node'],
      extensions: ['.js', '.ts', '.json']
    }),
    commonjs({
      ignoreDynamicRequires: true,
      transformMixedEsModules: true,
      requireReturnsDefault: 'preferred'
    }),
    json(),
    typescript({
      tsconfig: './tsconfig.json'
    })
  ],
  external: [
    'discord.js',
    '@solana/web3.js',
    '@solana/spl-token',
    'dotenv',
    'twitter-api-v2',
    'groq-sdk',
    /node_modules/
  ]
};