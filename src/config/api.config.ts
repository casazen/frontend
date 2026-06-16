const baseUrl = import.meta.env.VITE_API_BASE_URL || (
  import.meta.env.PROD
    ? 'https://casazen-api.up.railway.app/api'  // Production: Railway prod
    : 'https://localhost:5001/api'               // Development: local
);

export const apiConfig = {
  baseURL: baseUrl,
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
};
