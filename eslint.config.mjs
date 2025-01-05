import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default [
  {
    files: [
      'src/**/*.ts',
      'src/**/*.d.ts',
      'src/services/social/*.d.ts'
    ],
    ignores: [
      'dist/**/*',
      'node_modules/**/*'
    ],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: ['/home/ubuntu/repos/meme-agent/tsconfig.json'],
        tsconfigRootDir: '/home/ubuntu/repos/meme-agent',
        paths: {
          "@/*": ["/home/ubuntu/repos/meme-agent/src/*"]
        },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-function': 'warn',
    },
  },
];
