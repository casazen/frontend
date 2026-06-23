import { useEffect, useRef, useState } from 'react';
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
  const rolesRef = useRef(roles);
  rolesRef.current = roles;

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      const empty: string[] = [];
      if (!rolesEqual(rolesRef.current, empty)) setRoles(empty);
      return;
    }

    const fromProfile = getUserRoles(user);
    if (fromProfile.length > 0) {
      if (!rolesEqual(rolesRef.current, fromProfile)) setRoles(fromProfile);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const token = await getAccessToken();
        if (cancelled) return;
        const parsed = parseRolesFromAccessToken(token);
        if (!cancelled && !rolesEqual(rolesRef.current, parsed)) setRoles(parsed);
      } catch {
        if (!cancelled) {
          const empty: string[] = [];
          if (!rolesEqual(rolesRef.current, empty)) setRoles(empty);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, isAuthenticated, isLoading, user]);

  return roles;
}
