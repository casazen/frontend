import { useAuth0 } from '@auth0/auth0-react';
import { useEffect } from 'react';
import { setAccessTokenGetter } from '@/lib/axios';

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
    setAccessTokenGetter(getAccessTokenSilently);
  }, [getAccessTokenSilently]);

  const logout = () => {
    auth0Logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  };

  return {
    isLoading,
    isAuthenticated,
    user,
    login: loginWithRedirect,
    logout,
    getAccessToken: getAccessTokenSilently,
  };
}
