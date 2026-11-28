import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { hasNoWorkspaceRoles } from '@/lib/stale-session';

const RECOVERY_ATTEMPTED_KEY = 'cz-empty-workspace-recovery-attempted';

export function useEmptyWorkspaceRecovery(contextsCount: number, isReady: boolean) {
  const { getAccessToken, forceReauth } = useAuth();
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    if (!isReady || contextsCount > 0 || isRecovering) {
      return;
    }

    if (sessionStorage.getItem(RECOVERY_ATTEMPTED_KEY) === '1') {
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

      sessionStorage.setItem(RECOVERY_ATTEMPTED_KEY, '1');
      setIsRecovering(true);
      forceReauth();
    })();

    return () => {
      cancelled = true;
    };
  }, [contextsCount, forceReauth, getAccessToken, isReady, isRecovering]);

  return isRecovering;
}
