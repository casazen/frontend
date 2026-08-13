import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
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
import { setAccessTokenGetter } from '@/lib/axios';

const AUTH_PARAMS = {
  audience: import.meta.env.VITE_AUTH0_AUDIENCE || 'https://casazen-api',
  scope: 'openid profile email read:properties write:properties read:bookings write:bookings',
} as const;

type LoginOptions = {
  authorizationParams?: Record<string, string>;
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

export function useAuthBridge(): AuthBridgeValue {
  const ctx = useContext(AuthBridgeContext);
  if (!ctx) {
    throw new Error('useAuth must be used within App auth providers');
  }
  return ctx;
}

function DemoAuthBridge({ children }: { children: ReactNode }) {
  const demoUser = useMemo(
    () => getDemoUser(),
    // Re-read when E2E profile query changes
    [typeof window !== 'undefined' ? window.location.href : ''],
  );

  const getAccessToken = useCallback(async () => 'demo-token', []);
  const refreshAccessToken = useCallback(async () => 'demo-token', []);

  useEffect(() => {
    setAccessTokenGetter(getAccessToken);
  }, [getAccessToken]);

  const value = useMemo<AuthBridgeValue>(
    () => ({
      isLoading: false,
      isAuthenticated: true,
      user: demoUser,
      login: () => {
        console.log('Demo mode: login simulation');
      },
      logout: () => console.log('Demo mode: logout simulation'),
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

  useEffect(() => {
    setAccessTokenGetter(getAccessToken);
  }, [getAccessToken]);

  const login = useCallback(
    (options?: LoginOptions) => {
      void loginWithRedirect({
        authorizationParams: {
          ...AUTH_PARAMS,
          ...options?.authorizationParams,
        },
      });
    },
    [loginWithRedirect],
  );

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

export function AuthAppProviders({ children }: { children: ReactNode }) {
  if (isDemoMode) {
    return <DemoAuthBridge>{children}</DemoAuthBridge>;
  }

  return (
    <Auth0Provider {...authConfig}>
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
