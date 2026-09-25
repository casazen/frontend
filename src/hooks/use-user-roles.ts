import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getUserRoles, parseRolesFromAccessToken } from '@/lib/auth-roles';

function rolesEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((r, i) => r === b[i]);
}

export interface UserRoleState {
  roles: string[];
  /**
   * False while the roles are still being read (auth loading, or the access token being decoded when the ID token
   * profile carries none). Decisions that depend on the absence of a role (e.g. "no Admin role") must wait for it.
   */
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
    // Keep the previous array when the roles are unchanged: consumers use it as a hook dependency.
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

/**
 * CasaZen roles live in the access token (Auth0 Action), not the ID token profile.
 * Use this hook anywhere the UI needs role checks after login.
 */
export function useUserRoles(): string[] {
  return useUserRoleState().roles;
}
