const baseUrl = import.meta.env.VITE_API_BASE_URL || (
  import.meta.env.PROD
    ? 'https://casazen-api.up.railway.app/api'  // Production: Railway prod
    : 'http://localhost:5000/api'
);

export const apiConfig = {
  baseURL: baseUrl,
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
};
