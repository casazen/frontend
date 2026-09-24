import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import i18next from 'eslint-plugin-i18next'
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
    // Exception: tests may stub or spy on the global fetch and log freely.
    ignores: ['src/**/__tests__/**', 'src/**/*.test.{ts,tsx}', 'src/test/**'],
    rules: {
      // No debug logging in the shipped bundle (A9-36, A1-34): console.log/info/debug may leak tokens or personal
      // data into the browser console of every user. warn/error stay for real problems, without secrets.
      'no-console': ['error', { allow: ['warn', 'error'] }],
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
    // i18n (A9-25): user-visible text in JSX goes through t() with keys in it.json and en.json.
    // Warn only: it reports literal JSX text and literal values of user-visible attributes.
    files: ['src/**/*.tsx'],
    // supplier-shell.tsx is dead code deleted by task SU-16.
    ignores: ['src/**/__tests__/**', 'src/**/*.test.tsx', 'src/test/**', 'src/features/supplier/supplier-shell.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'warn',
        {
          mode: 'jsx-only',
          'jsx-attributes': {
            include: ['placeholder', 'title', 'alt', 'aria-label', 'aria-description', 'label', 'description', 'message'],
          },
          callees: {
            exclude: [
              'i18n(ext)?', 't', 'require', 'cn', 'clsx', 'register', 'watch', 'setValue', 'getValues', 'trigger',
              'navigate', 'format', 'formatDate', 'formatDateTime', 'formatCurrency', 'toLocale\\w*',
              'Intl\\.\\w+', 'Date', 'URLSearchParams', 'searchParams\\.\\w+', 'window\\.open',
              'setParams', 'includes', 'startsWith', 'endsWith', 'indexOf', 'split', 'join', 'replace',
              'querySelector\\w*', 'getElementById', 'addEventListener', 'removeEventListener', 'invalidateQueries',
            ],
          },
          'object-properties': {
            exclude: ['[A-Z_-]+', 'weekday', 'year', 'month', 'day', 'hour', 'minute', 'second', 'timeZone', 'style', 'currency', 'queryKey', 'variant', 'size', 'mode'],
          },
          words: {
            exclude: [
              // symbols, numbers and punctuation (including typographic ones)
              '[\\s\\d!-/:-@[-`{-~·•—–×✓✔○Δ€£%©→←↑↓]+',
              /^[\p{Extended_Pictographic}\s]+$/u,
              // constants, codes and identifiers (e.g. H501, IT-12345-0123456789)
              '[A-Z0-9_-]+',
              // URLs and domains used as examples
              '(https?://|www\\.)\\S*',
              // brand and product names
              'CasaZen', 'CASAZEN', 'Google Maps', 'Stripe', 'Auth0', 'Airbnb', 'Booking\\.com', 'iCal',
            ],
          },
        },
      ],
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
