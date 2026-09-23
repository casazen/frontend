import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// All API calls go through ApiClient / '@/lib/axios': base URL from VITE_API_BASE_URL, bearer
// token, 401/403 handling and ProblemDetails parsing. A relative fetch('/api/...') hits the
// Vercel SPA rewrite and gets index.html back (A9-21).
const NO_DIRECT_FETCH =
  "Use ApiClient (src/api/client.ts) or '@/lib/axios' instead of fetch: base URL, auth and error handling live there."

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    // Exception: tests may stub or spy on the global fetch.
    ignores: ['src/**/__tests__/**', 'src/**/*.test.{ts,tsx}', 'src/test/**'],
    rules: {
      'no-restricted-globals': ['error', { name: 'fetch', message: NO_DIRECT_FETCH }],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'fetch', message: NO_DIRECT_FETCH },
        { object: 'globalThis', property: 'fetch', message: NO_DIRECT_FETCH },
        { object: 'self', property: 'fetch', message: NO_DIRECT_FETCH },
      ],
    },
  },
  {
    // Exception: the SupplierJob QR check-in page is deleted by task SU-11 (decision D12),
    // so it is not migrated to ApiClient.
    files: ['src/pages/supplier-check-in.tsx'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },
  {
    // Playwright code is not React: its fixtures receive a callback named `use`,
    // which react-hooks mistakes for React's use() hook.
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
])
