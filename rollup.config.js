import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';

export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'es',
    sourcemap: true,
    preserveModules: true
  },
  external: [
    /node_modules/,
    'express',
    'mongoose',
    'typeorm',
    'redis',
    'winston',
    'dotenv',
    'cors',
    'helmet',
    'jsonwebtoken',
    'uuid',
    'zod'
  ],
  plugins: [
    replace({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      preventAssignment: true
    }),
    resolve({
      preferBuiltins: true,
      extensions: ['.ts', '.js', '.json']
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      sourceMap: true,
      inlineSources: true
    }),
    json()
  ]
};