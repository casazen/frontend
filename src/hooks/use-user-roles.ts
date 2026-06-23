import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getUserRoles, parseRolesFromAccessToken } from '@/lib/auth-roles';

/**
 * CasaZen roles live in the access token (Auth0 Action), not the ID token profile.
 * Use this hook anywhere the UI needs role checks after login.
 */
export function useUserRoles(): string[] {
  const { user, isAuthenticated, isLoading, getAccessToken } = useAuth();
  const [roles, setRoles] = useState<string[]>(() => getUserRoles(user));

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      setRoles([]);
      return;
    }

    const fromProfile = getUserRoles(user);
    if (fromProfile.length > 0) {
      setRoles(fromProfile);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const token = await getAccessToken();
        if (cancelled) return;
        setRoles(parseRolesFromAccessToken(token));
      } catch {
        if (!cancelled) {
          setRoles([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, isAuthenticated, isLoading, user]);

  return roles;
}
