import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useMemo } from 'react';
import { setAccessTokenGetter } from '@/lib/axios';
import { isDemoMode, getDemoUser } from '@/config/demo.config';

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
  useEffect(() => {
    if (!isDemoMode) {
      setAccessTokenGetter(() =>
        getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_AUDIENCE || 'https://casazen-api',
            scope: 'openid profile email read:properties write:properties read:bookings write:bookings',
          },
        })
      );
    }
  }, [getAccessTokenSilently]);

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

  const demoUser = useMemo(() => getDemoUser(), [typeof window !== 'undefined' ? window.location.href : '']);

  // In demo mode, return mock authentication state
  if (isDemoMode) {
    return {
      isLoading: false,
      isAuthenticated: true,
      user: demoUser,
      login: () => console.log('Demo mode: login simulation'),
      logout,
      getAccessToken: async () => 'demo-token',
    };
  }

  return {
    isLoading,
    isAuthenticated,
    user,
    login: loginWithRedirect,
    logout,
    getAccessToken: () => getAccessTokenSilently({
      authorizationParams: {
        audience: import.meta.env.VITE_AUTH0_AUDIENCE || 'https://casazen-api',
        scope: 'openid profile email read:properties write:properties read:bookings write:bookings',
      },
    }),
  };
}
