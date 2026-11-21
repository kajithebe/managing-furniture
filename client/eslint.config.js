import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['node_modules/', 'dist/'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // console.log is not allowed; warnings and real errors are.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      // Unused variables are bugs; a leading _ marks an argument as unused on purpose.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Always === instead of ==.
      eqeqeq: ['error', 'always'],
      // Security rule from 02: never render raw HTML.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML is not allowed (02 › Security).',
        },
      ],
    },
  },
  {
    // Config files (vite, tailwind, postcss) run in Node, not in the browser.
    files: ['*.config.js'],
    languageOptions: { globals: globals.node },
  },
  prettier,
];
