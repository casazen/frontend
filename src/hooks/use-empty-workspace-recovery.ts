import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { hasNoWorkspaceRoles } from '@/lib/stale-session';

/**
 * When workspace bootstrap yields zero contexts, a cached Auth0 session may still
 * report isAuthenticated=true without roles in the access token. Clear it so /login is reachable.
 */
export function useEmptyWorkspaceRecovery(contextsCount: number, isReady: boolean) {
  const { getAccessToken, logoutToLogin } = useAuth();
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    if (!isReady || contextsCount > 0 || isRecovering) {
      return;
    }

    let cancelled = false;

    void (async () => {
      if (!(await hasNoWorkspaceRoles(getAccessToken))) {
        return;
      }

      if (cancelled) {
        return;
      }

      setIsRecovering(true);
      logoutToLogin();
    })();

    return () => {
      cancelled = true;
    };
  }, [contextsCount, getAccessToken, isReady, isRecovering, logoutToLogin]);

  return isRecovering;
}
