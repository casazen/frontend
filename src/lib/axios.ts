import axios, { isAxiosError } from 'axios';
import type { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { apiConfig } from '@/config/api.config';
import { AuthTokenUnavailableError, getProblemCode } from '@/lib/api-errors';

declare module 'axios' {
  interface AxiosRequestConfig {
    /**
     * Anonymous endpoint (backend `[AllowAnonymous]`): sent without an access token, and its
     * 401/403 responses never trigger re-login or the no-access page. Every other request
     * requires a token and is not sent at all when none can be obtained.
     */
    public?: boolean;
    /** Internal: the request was already replayed once after a forced token refresh. */
    authRetried?: boolean;
  }
}

export interface ApiAuthHandlers {
  /** Returns the access token; throws (e.g. Auth0 `login_required`) when there is none. */
  getAccessToken: () => Promise<string | undefined>;
  /** Fetches a fresh token bypassing the cache; used once after a 401 before re-login. */
  refreshAccessToken?: () => Promise<string | undefined>;
  /** Starts an interactive re-login (Auth0 redirect). */
  onSessionExpired?: () => void;
}

/** Path of the existing "no access" page used for 403 on protected reads. */
export const NO_ACCESS_PATH = '/app/no-access';

/** A second re-login inside this window means the redirect did not help: stop to avoid a loop. */
export const RELOGIN_GUARD_MS = 60_000;
export const RELOGIN_GUARD_STORAGE_KEY = 'cz-api-relogin-at';

/** Auth0 token errors that only an interactive login can solve. */
const INTERACTIVE_LOGIN_ERRORS = new Set([
  'login_required',
  'consent_required',
  'interaction_required',
  'missing_refresh_token',
  'invalid_grant',
]);

/** 403 bodies with these codes (or none) mean "no access"; any other code is a business rule. */
const GENERIC_FORBIDDEN_CODES = new Set(['forbidden', 'access_denied']);

let authHandlers: ApiAuthHandlers | null = null;
let forbiddenHandler: (() => void) | null = null;
let reloginRequested = false;

/** Registered by the auth bridge (Auth0 or demo); `null` when no auth provider is mounted. */
export function setApiAuthHandlers(handlers: ApiAuthHandlers | null): void {
  authHandlers = handlers;
}

/** Registered by the app shell: navigates to the no-access page. */
export function setApiForbiddenHandler(handler: (() => void) | null): void {
  forbiddenHandler = handler;
}

function readLastRelogin(): number | null {
  try {
    const raw = window.sessionStorage.getItem(RELOGIN_GUARD_STORAGE_KEY);
    const value = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeLastRelogin(timestamp: number): void {
  try {
    window.sessionStorage.setItem(RELOGIN_GUARD_STORAGE_KEY, String(timestamp));
  } catch {
    // Storage unavailable: the in-memory flag still prevents repeated redirects on this page.
  }
}

/** Starts at most one re-login per page, and none if the previous one was less than a minute ago. */
function requestRelogin(): void {
  const onSessionExpired = authHandlers?.onSessionExpired;
  if (!onSessionExpired || reloginRequested) return;

  const now = Date.now();
  const last = readLastRelogin();
  if (last !== null && now >= last && now - last < RELOGIN_GUARD_MS) return;

  reloginRequested = true;
  writeLastRelogin(now);
  onSessionExpired();
}

function auth0ErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const code = (error as { error?: unknown }).error;
    if (typeof code === 'string' && code) return code;
  }
  return 'token_error';
}

async function attachAccessToken(config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> {
  if (config.public) return config;

  const getAccessToken = authHandlers?.getAccessToken;
  if (!getAccessToken) throw new AuthTokenUnavailableError('no_auth_provider');

  let token: string | undefined;
  try {
    token = await getAccessToken();
  } catch (error) {
    const reason = auth0ErrorCode(error);
    if (INTERACTIVE_LOGIN_ERRORS.has(reason)) requestRelogin();
    throw new AuthTokenUnavailableError(reason, { cause: error });
  }

  if (!token) throw new AuthTokenUnavailableError('empty_token');
  config.headers.Authorization = `Bearer ${token}`;
  return config;
}

function isAccessDenied(config: InternalAxiosRequestConfig, data: unknown): boolean {
  // Only reads: a forbidden write keeps the user on the page and is reported by the mutation.
  const method = (config.method ?? 'get').toLowerCase();
  if (method !== 'get' && method !== 'head') return false;
  const code = getProblemCode(data);
  return code === undefined || GENERIC_FORBIDDEN_CODES.has(code.toLowerCase());
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

async function handleResponseError(error: unknown): Promise<AxiosResponse> {
  if (!isAxiosError(error) || !error.response || !error.config || error.config.public) {
    throw error;
  }

  const { config } = error;
  const { status, data } = error.response;

  if (status === 401) {
    const refreshAccessToken = authHandlers?.refreshAccessToken;
    if (!config.authRetried && refreshAccessToken) {
      config.authRetried = true;
      let refreshed: string | undefined;
      try {
        refreshed = await refreshAccessToken();
      } catch {
        refreshed = undefined;
      }
      // Replay once: the request interceptor attaches the refreshed (now cached) token.
      if (refreshed) return axiosInstance.request(config);
    }
    requestRelogin();
  } else if (status === 403 && isAccessDenied(config, data)) {
    forbiddenHandler?.();
  }

  throw error;
}

axiosInstance.interceptors.request.use(attachAccessToken);
axiosInstance.interceptors.response.use((response) => response, handleResponseError);

export default axiosInstance;
