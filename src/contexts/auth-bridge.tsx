import { Auth0Provider, useAuth0, type AppState } from '@auth0/auth0-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { authConfig } from '@/config/auth.config';
import { getDemoUser, isDemoMode } from '@/config/demo.config';
import { setApiAuthHandlers } from '@/lib/axios';

const AUTH_PARAMS = {
  audience: import.meta.env.VITE_AUTH0_AUDIENCE || 'https://casazen-api',
  scope: 'openid profile email read:properties write:properties read:bookings write:bookings',
} as const;

type LoginOptions = {
  authorizationParams?: Record<string, string>;
  /** Path of this app to open after the login (e.g. back to an invite page); default: the app root. */
  returnTo?: string;
  /**
   * Extra values carried through the redirect in the SDK `appState` (kept in this browser, never sent to Auth0) and
   * handed back to `onRedirectCallback`, e.g. the pending supplier claim (SU-02).
   */
  appState?: Record<string, unknown>;
};

export type AuthBridgeValue = {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: ReturnType<typeof useAuth0>['user'] | ReturnType<typeof getDemoUser> | undefined;
  login: (options?: LoginOptions) => void;
  logout: () => void;
  logoutToLogin: () => void;
  forceReauth: () => void;
  getAccessToken: () => Promise<string | undefined>;
  refreshAccessToken: () => Promise<string | undefined>;
};

const AuthBridgeContext = createContext<AuthBridgeValue | null>(null);

// Context hook colocated with its providers; fast refresh falls back to a full reload for this file.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuthBridge(): AuthBridgeValue {
  const ctx = useContext(AuthBridgeContext);
  if (!ctx) {
    throw new Error('useAuth must be used within App auth providers');
  }
  return ctx;
}

function DemoAuthBridge({ children }: { children: ReactNode }) {
  // Re-read the persona when the E2E `?demoProfile=` URL changes.
  const href = typeof window !== 'undefined' ? window.location.href : '';
  const demoUser = useMemo(() => getDemoUser(href), [href]);

  const getAccessToken = useCallback(async () => 'demo-token', []);
  const refreshAccessToken = useCallback(async () => 'demo-token', []);

  useEffect(() => {
    // Demo tokens never expire: no re-login handler.
    setApiAuthHandlers({ getAccessToken, refreshAccessToken });
    return () => setApiAuthHandlers(null);
  }, [getAccessToken, refreshAccessToken]);

  const value = useMemo<AuthBridgeValue>(
    () => ({
      isLoading: false,
      isAuthenticated: true,
      user: demoUser,
      // Demo mode: the demo user is always signed in, login and logout have nothing to do.
      login: () => {},
      logout: () => {},
      logoutToLogin: () => window.location.replace('/login'),
      forceReauth: () => window.location.replace('/login'),
      getAccessToken,
      refreshAccessToken,
    }),
    [demoUser, getAccessToken, refreshAccessToken],
  );

  return <AuthBridgeContext.Provider value={value}>{children}</AuthBridgeContext.Provider>;
}

/** Public booking / SEO paths — no Auth0 SPA SDK (works on http://LAN-IP). */
function AnonymousAuthBridge({ children }: { children: ReactNode }) {
  const value = useMemo<AuthBridgeValue>(
    () => ({
      isLoading: false,
      isAuthenticated: false,
      user: undefined,
      login: () => {
        window.location.assign('/login');
      },
      logout: () => undefined,
      logoutToLogin: () => window.location.replace('/login'),
      forceReauth: () => window.location.assign('/login'),
      getAccessToken: async () => undefined,
      refreshAccessToken: async () => undefined,
    }),
    [],
  );

  return <AuthBridgeContext.Provider value={value}>{children}</AuthBridgeContext.Provider>;
}

function Auth0AuthBridge({ children }: { children: ReactNode }) {
  const {
    isLoading,
    isAuthenticated,
    user,
    loginWithRedirect,
    logout: auth0Logout,
    getAccessTokenSilently,
  } = useAuth0();

  const getAccessToken = useCallback(
    () => getAccessTokenSilently({ authorizationParams: AUTH_PARAMS }),
    [getAccessTokenSilently],
  );

  const refreshAccessToken = useCallback(
    () => getAccessTokenSilently({ authorizationParams: AUTH_PARAMS, cacheMode: 'off' }),
    [getAccessTokenSilently],
  );

  const login = useCallback(
    (options?: LoginOptions) => {
      const appState = {
        ...options?.appState,
        ...(options?.returnTo ? { returnTo: options.returnTo } : {}),
      };
      void loginWithRedirect({
        authorizationParams: {
          ...AUTH_PARAMS,
          ...options?.authorizationParams,
        },
        ...(Object.keys(appState).length > 0 ? { appState } : {}),
      });
    },
    [loginWithRedirect],
  );

  useEffect(() => {
    setApiAuthHandlers({
      getAccessToken,
      refreshAccessToken,
      // 401 after a token refresh (or Auth0 `login_required`): Auth0 redirect, loop-guarded by the client.
      onSessionExpired: () => login(),
    });
    return () => setApiAuthHandlers(null);
  }, [getAccessToken, refreshAccessToken, login]);

  const logout = useCallback(() => {
    auth0Logout({
      logoutParams: { returnTo: window.location.origin },
    });
  }, [auth0Logout]);

  const forceReauth = useCallback(() => {
    void loginWithRedirect({
      authorizationParams: { ...AUTH_PARAMS, prompt: 'login' },
    });
  }, [loginWithRedirect]);

  const logoutToLogin = useCallback(() => {
    auth0Logout({
      logoutParams: { returnTo: window.location.origin },
    });
  }, [auth0Logout]);

  const value = useMemo<AuthBridgeValue>(
    () => ({
      isLoading,
      isAuthenticated,
      user,
      login,
      logout,
      logoutToLogin,
      forceReauth,
      getAccessToken,
      refreshAccessToken,
    }),
    [
      isLoading,
      isAuthenticated,
      user,
      login,
      logout,
      logoutToLogin,
      forceReauth,
      getAccessToken,
      refreshAccessToken,
    ],
  );

  return <AuthBridgeContext.Provider value={value}>{children}</AuthBridgeContext.Provider>;
}

export function AuthAppProviders({
  children,
  onRedirectCallback,
}: {
  children: ReactNode;
  /** Called by the SDK after the Auth0 redirect, with the `appState` passed to `login` (e.g. `returnTo`). */
  onRedirectCallback?: (appState?: AppState) => void;
}) {
  if (isDemoMode) {
    return <DemoAuthBridge>{children}</DemoAuthBridge>;
  }

  return (
    <Auth0Provider {...authConfig} onRedirectCallback={onRedirectCallback}>
      <Auth0AuthBridge>{children}</Auth0AuthBridge>
    </Auth0Provider>
  );
}

export function PublicAppProviders({ children }: { children: ReactNode }) {
  if (isDemoMode) {
    return <DemoAuthBridge>{children}</DemoAuthBridge>;
  }
  return <AnonymousAuthBridge>{children}</AnonymousAuthBridge>;
}
