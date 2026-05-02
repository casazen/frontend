export const apiConfig = {
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://localhost:5001/api',  // ✅ Fixed: was http://localhost:3000/api
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
};
