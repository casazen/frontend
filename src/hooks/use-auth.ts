import { useAuth0 } from '@auth0/auth0-react';
import { useCallback, useEffect, useMemo } from 'react';
import { setAccessTokenGetter } from '@/lib/axios';
import { isDemoMode, getDemoUser } from '@/config/demo.config';

const AUTH_PARAMS = {
  audience: import.meta.env.VITE_AUTH0_AUDIENCE || 'https://casazen-api',
  scope: 'openid profile email read:properties write:properties read:bookings write:bookings',
} as const;

export function useAuth() {
  const {
    isLoading,
    isAuthenticated,
    user,
    loginWithRedirect,
    logout: auth0Logout,
    getAccessTokenSilently
  } = useAuth0();

  // Set up the access token getter for axios
  const getAccessToken = useCallback(
    () => getAccessTokenSilently({ authorizationParams: AUTH_PARAMS }),
    [getAccessTokenSilently],
  );

  const refreshAccessToken = useCallback(
    () => getAccessTokenSilently({ authorizationParams: AUTH_PARAMS, cacheMode: 'off' }),
    [getAccessTokenSilently],
  );

  useEffect(() => {
    if (!isDemoMode) {
      setAccessTokenGetter(getAccessToken);
    }
  }, [getAccessToken]);

  const logout = () => {
    if (isDemoMode) {
      console.log('Demo mode: logout simulation');
      return;
    }
    auth0Logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  };

  const forceReauth = useCallback(() => {
    if (isDemoMode) {
      window.location.replace('/login');
      return;
    }
    void loginWithRedirect({
      authorizationParams: {
        ...AUTH_PARAMS,
        prompt: 'login',
      },
    });
  }, [loginWithRedirect]);

  const logoutToLogin = useCallback(() => {
    if (isDemoMode) {
      window.location.replace('/login');
      return;
    }
    // returnTo must be listed in Auth0 Allowed Logout URLs (origin only, not /login).
    auth0Logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  }, [auth0Logout]);

  const demoUser = useMemo(() => getDemoUser(), [typeof window !== 'undefined' ? window.location.href : '']);

  const demoLogin = useCallback(() => console.log('Demo mode: login simulation'), []);
  const demoGetAccessToken = useCallback(async () => 'demo-token', []);
  const demoRefreshAccessToken = useCallback(async () => 'demo-token', []);
  const demoLogoutToLogin = useCallback(() => window.location.replace('/login'), []);
  const demoForceReauth = useCallback(() => window.location.replace('/login'), []);

  // In demo mode, return mock authentication state
  if (isDemoMode) {
    return {
      isLoading: false,
      isAuthenticated: true,
      user: demoUser,
      login: demoLogin,
      logout,
      getAccessToken: demoGetAccessToken,
      refreshAccessToken: demoRefreshAccessToken,
      logoutToLogin: demoLogoutToLogin,
      forceReauth: demoForceReauth,
    };
  }

  return {
    isLoading,
    isAuthenticated,
    user,
    login: loginWithRedirect,
    logout,
    logoutToLogin,
    forceReauth,
    getAccessToken,
    refreshAccessToken,
  };
}
