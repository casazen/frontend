import axios, { isAxiosError } from 'axios';
import type { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { isGuidedDemo } from '@/lib/guided-demo/session';
import { apiConfig } from '@/config/api.config';
import { ACCOUNT_INACTIVE_CODE, AuthTokenUnavailableError, getProblemCode } from '@/lib/api-errors';

declare module 'axios' {
  interface AxiosRequestConfig {
    /**
     * Anonymous endpoint (backend `[AllowAnonymous]`): sent without an access token, and its
     * 401/403 responses never trigger re-login or the no-access page. Every other request
     * requires a token and is not sent at all when none can be obtained.
     */
    public?: boolean;
    localAuthRecovery?: boolean;
    authRetried?: boolean;
  }
}

export interface ApiAuthHandlers {
  getAccessToken: () => Promise<string | undefined>;
  refreshAccessToken?: () => Promise<string | undefined>;
  onSessionExpired?: () => void;
}

export const NO_ACCESS_PATH = '/app/no-access';

export const ACCOUNT_INACTIVE_PATH = '/account-inactive';

export const RELOGIN_GUARD_MS = 60_000;
export const RELOGIN_GUARD_STORAGE_KEY = 'cz-api-relogin-at';

const INTERACTIVE_LOGIN_ERRORS = new Set([
  'login_required',
  'consent_required',
  'interaction_required',
  'missing_refresh_token',
  'invalid_grant',
]);

const GENERIC_FORBIDDEN_CODES = new Set(['forbidden', 'access_denied']);

export const ONBOARDING_REQUIRED_CODE = 'onboarding_required';

let authHandlers: ApiAuthHandlers | null = null;
let forbiddenHandler: (() => void) | null = null;
let accountInactiveHandler: (() => void) | null = null;
let onboardingRequiredHandler: (() => void) | null = null;
let reloginRequested = false;

export function setApiAuthHandlers(handlers: ApiAuthHandlers | null): void {
  authHandlers = handlers;
}

export function setApiForbiddenHandler(handler: (() => void) | null): void {
  forbiddenHandler = handler;
}

export function setApiAccountInactiveHandler(handler: (() => void) | null): void {
  accountInactiveHandler = handler;
}

export function setApiOnboardingRequiredHandler(handler: (() => void) | null): void {
  onboardingRequiredHandler = handler;
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
  if (isGuidedDemo()) {
    config.adapter = (await import('@/lib/guided-demo/adapter')).guidedDemoAdapter;
    return config;
  }
  if (config.public) return config;

  const getAccessToken = authHandlers?.getAccessToken;
  if (!getAccessToken) throw new AuthTokenUnavailableError('no_auth_provider');

  let token: string | undefined;
  try {
    token = await getAccessToken();
  } catch (error) {
    const reason = auth0ErrorCode(error);
    if (!config.localAuthRecovery && INTERACTIVE_LOGIN_ERRORS.has(reason)) requestRelogin();
    throw new AuthTokenUnavailableError(reason, { cause: error });
  }

  if (!token) throw new AuthTokenUnavailableError('empty_token');
  config.headers.Authorization = `Bearer ${token}`;
  return config;
}

function isAccessDenied(config: InternalAxiosRequestConfig, data: unknown): boolean {
  const method = (config.method ?? 'get').toLowerCase();
  if (method !== 'get' && method !== 'head') return false;
  const code = getProblemCode(data);
  return code === undefined || GENERIC_FORBIDDEN_CODES.has(code.toLowerCase());
}

/**
 * The two 403 of an account that the app answers with a page of its own, whatever the method: the account that was deactivated (`account_inactive`, PL-03) and the host who
 * has not finished the onboarding (`onboarding_required`, PL-02). Runs the handler of the one the body names and says whether it was one; `account_inactive` goes first, an
 * inactive account takes precedence over every other 403 code. The response interceptor below calls it for a rejected 403. A read that takes a 403 as an answer
 * (`validateStatus`) never reaches that interceptor, which only sees rejected responses: such a read calls this itself, before it tells the refusal in its own words.
 */
export function handleAccountStateForbidden(data: unknown): boolean {
  const code = getProblemCode(data);
  if (code === ACCOUNT_INACTIVE_CODE) {
    accountInactiveHandler?.();
    return true;
  }
  if (code === ONBOARDING_REQUIRED_CODE) {
    onboardingRequiredHandler?.();
    return true;
  }
  return false;
}

const axiosInstance: AxiosInstance = axios.create({
  baseURL: apiConfig.baseURL,
  timeout: apiConfig.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
  // The API takes a bearer token and never a cookie, so there is no XSRF token to look for. Left on, axios reads `document.cookie` for one on every request to the origin
  // of the page (an API under the host of the page: the dev server, the L2 suite, the cross-origin proof of the widgets), and a page of `/embed/*` reads no cookie
  // (NF-144, AC-NF144-3): where the browser refuses the cookie that read throws and takes every request with it, the widget never loads.
  withXSRFToken: false,
});

async function handleResponseError(error: unknown): Promise<AxiosResponse> {
  if (!isAxiosError(error) || !error.response || !error.config || error.config.public || error.config.localAuthRecovery) {
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
      if (refreshed) return axiosInstance.request(config);
    }
    requestRelogin();
  } else if (status === 403 && !handleAccountStateForbidden(data) && isAccessDenied(config, data)) {
    forbiddenHandler?.();
  }

  throw error;
}

axiosInstance.interceptors.request.use(attachAccessToken);
axiosInstance.interceptors.response.use((response) => response, handleResponseError);

export default axiosInstance;
