import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getUserRoles, parseRolesFromAccessToken } from '@/lib/auth-roles';

function rolesEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((r, i) => r === b[i]);
}

/**
 * CasaZen roles live in the access token (Auth0 Action), not the ID token profile.
 * Use this hook anywhere the UI needs role checks after login.
 */
export function useUserRoles(): string[] {
  const { user, isAuthenticated, isLoading, getAccessToken } = useAuth();
  const [roles, setRoles] = useState<string[]>(() => getUserRoles(user));

  useEffect(() => {
    // Keep the previous array when the roles are unchanged: consumers use it as a hook dependency.
    const updateRoles = (next: string[]) =>
      setRoles((previous) => (rolesEqual(previous, next) ? previous : next));

    if (isLoading || !isAuthenticated) {
      updateRoles([]);
      return;
    }

    const fromProfile = getUserRoles(user);
    if (fromProfile.length > 0) {
      updateRoles(fromProfile);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const token = await getAccessToken();
        if (cancelled) return;
        updateRoles(parseRolesFromAccessToken(token));
      } catch {
        if (!cancelled) updateRoles([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, isAuthenticated, isLoading, user]);

  return roles;
}
