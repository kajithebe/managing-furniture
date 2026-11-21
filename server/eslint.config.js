import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['node_modules/', 'prisma/migrations/'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      // console.log is not allowed; startup info and real errors are.
      'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
      // Unused variables are bugs; a leading _ marks an argument as unused on purpose.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Always === instead of ==.
      eqeqeq: ['error', 'always'],
    },
  },
  prettier,
];
