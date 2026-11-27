import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getUserRoles, parseRolesFromAccessToken } from '@/lib/auth-roles';

function rolesEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((r, i) => r === b[i]);
}

export interface UserRoleState {
  roles: string[];
  isResolved: boolean;
}

/**
 * CasaZen roles live in the access token (Auth0 Action), not always in the ID token profile.
 * Returns the roles and whether they are known yet.
 */
export function useUserRoleState(): UserRoleState {
  const { user, isAuthenticated, isLoading, getAccessToken } = useAuth();
  const [state, setState] = useState<UserRoleState>(() => {
    const fromProfile = getUserRoles(user);
    return { roles: fromProfile, isResolved: !isLoading && (!isAuthenticated || fromProfile.length > 0) };
  });

  useEffect(() => {
    const update = (next: string[], isResolved: boolean) =>
      setState((previous) => {
        const sameRoles = rolesEqual(previous.roles, next);
        if (sameRoles && previous.isResolved === isResolved) return previous;
        return { roles: sameRoles ? previous.roles : next, isResolved };
      });

    if (isLoading) {
      update([], false);
      return;
    }

    if (!isAuthenticated) {
      update([], true);
      return;
    }

    const fromProfile = getUserRoles(user);
    if (fromProfile.length > 0) {
      update(fromProfile, true);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const token = await getAccessToken();
        if (cancelled) return;
        update(parseRolesFromAccessToken(token), true);
      } catch {
        if (!cancelled) update([], true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, isAuthenticated, isLoading, user]);

  return state;
}

export function useUserRoles(): string[] {
  return useUserRoleState().roles;
}
