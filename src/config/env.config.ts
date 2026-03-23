// Environment configuration with validation
export const env = {
  auth0: {
    domain: import.meta.env.VITE_AUTH0_DOMAIN || 'dev-casazen.auth0.com',
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID || '',
    audience: import.meta.env.VITE_AUTH0_AUDIENCE || 'https://casazen-api',
  },
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  },
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
} as const;

// Validate required env vars
if (!env.auth0.clientId && env.isProduction) {
  console.error('Missing VITE_AUTH0_CLIENT_ID environment variable');
}

if (!env.auth0.domain && env.isProduction) {
  console.error('Missing VITE_AUTH0_DOMAIN environment variable');
}
