import axios, { AxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { apiConfig } from '@/config/api.config';

let getAccessToken: (() => Promise<string | undefined>) | null = null;

/**
 * Set the function to get the access token
 * This will be called from the Auth0Provider setup
 */
export function setAccessTokenGetter(getter: () => Promise<string | undefined>) {
  getAccessToken = getter;
}

/**
 * Create axios instance with base configuration
 */
const axiosInstance: AxiosInstance = axios.create({
  baseURL: apiConfig.baseURL,
  timeout: apiConfig.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor to add JWT token
 */
axiosInstance.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Skip auth for public endpoints
    const publicEndpoints = ['/health', '/auth/', '/properties/search'];
    const isPublicEndpoint =
      publicEndpoints.some((endpoint) => config.url?.includes(endpoint)) ||
      (config.url?.includes('/properties/') && config.url.includes('/public'));
    
    if (!isPublicEndpoint && getAccessToken) {
      try {
        const token = await getAccessToken();
        console.log('[Auth Debug] Token retrieved:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
          console.log('[Auth Debug] Authorization header set:', `Bearer ${token.substring(0, 20)}...`);
        } else {
          console.warn('[Auth Debug] No token available - request will be sent without auth');
          console.warn('[Auth Debug] This may cause 401 errors for protected endpoints');
        }
      } catch (error) {
        console.error('[Auth Debug] Error getting token:', error);
        // If we can't get a token and this is a protected endpoint, we should probably fail
        if (error instanceof Error && error.message.includes('login_required')) {
          console.error('[Auth Debug] Login required - user not authenticated');
        }
      }
    } else if (!isPublicEndpoint) {
      console.warn('[Auth Debug] getAccessToken not set - no auth will be sent');
      console.warn('[Auth Debug] Make sure AuthInitializer is rendered and user is logged in');
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor for error handling
 */
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;

      switch (status) {
        case 401:
          // Unauthorized - token expired or invalid
          console.error('Unauthorized access - please login again');
          // Redirect to login if needed
          if (window.location.pathname !== '/login') {
            console.warn('[Auth Debug] 401 received - user may need to login');
          }
          break;
        case 403:
          // Forbidden - user doesn't have permission
          console.error('Access forbidden - insufficient permissions');
          break;
        case 404:
          // Not found
          console.error('Resource not found');
          break;
        case 400:
          // Bad request - validation errors
          console.error('Bad request:', error.response.data);
          break;
        case 500:
          // Server error
          console.error('Server error - please try again later');
          break;
        default:
          console.error(`Request failed with status ${status}`);
      }
    } else if (error.request) {
      // Request made but no response
      console.error('No response from server - check your connection');
    } else {
      // Error in request setup
      console.error('Request setup error:', error.message);
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
