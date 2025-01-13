import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/bundle.esm.js',
      format: 'esm',
      sourcemap: true
    },
    {
      file: 'dist/bundle.cjs.js',
      format: 'cjs',
      sourcemap: true
    }
  ],
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
    'zod',
    'path',
    'fs',
    'crypto',
    'events',
    'util',
    'zlib',
    'tslib'
  ],
  plugins: [
    replace({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      preventAssignment: true
    }),
    resolve({
      preferBuiltins: false
    }),
    commonjs({
      include: /node_modules/,
      transformMixedEsModules: true
    }),
    typescript({
      tsconfig: './tsconfig.json',
      sourceMap: true,
      inlineSources: true
    }),
    json(),
    terser()
  ]
};