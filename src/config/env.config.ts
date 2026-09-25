import { isDemoMode } from './demo.config';

// Environment configuration with validation.
// No default Auth0 tenant (PL-11, A1-32): every environment sets its own (Vercel Preview → test tenant, Production →
// production tenant; local .env → a development/test tenant), see backend docs/runbooks/auth0.md section 1.
const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN || '';

const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID || '';

if (import.meta.env.PROD && !isDemoMode && !auth0Domain) {
  throw new Error(
    'VITE_AUTH0_DOMAIN is missing. Set it in Vercel → Environment Variables (Preview and/or Production), then redeploy.',
  );
}

if (import.meta.env.PROD && !isDemoMode && !auth0ClientId) {
  throw new Error(
    'VITE_AUTH0_CLIENT_ID is missing. Set it in Vercel → Environment Variables (Preview and/or Production), then redeploy.',
  );
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || (
  import.meta.env.PROD
    ? 'https://casazen-api.up.railway.app/api'  // Production: Railway prod
    : 'http://localhost:5000/api'
);

export const env = {
  auth0: {
    domain: auth0Domain,
    clientId: auth0ClientId,
    audience: import.meta.env.VITE_AUTH0_AUDIENCE || 'https://casazen-api',
  },
  api: {
    baseUrl: apiBaseUrl,
  },
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
} as const;
