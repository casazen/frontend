import { useAuth0 } from '@auth0/auth0-react';
import { useEffect } from 'react';
import { setAccessTokenGetter } from '@/lib/axios';
import { isDemoMode, demoUser } from '@/config/demo.config';

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
          authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE || 'https://casazen-api' },
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
    getAccessToken: getAccessTokenSilently,
  };
}
