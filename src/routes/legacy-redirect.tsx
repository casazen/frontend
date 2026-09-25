import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { matchPath } from 'react-router-dom';
import { ROUTE_MANIFEST } from '@/config/route-manifest';
import { useWorkspace } from '@/hooks/use-workspace';
import { useEmptyWorkspaceRecovery } from '@/hooks/use-empty-workspace-recovery';
import { LoadingScreen } from '@/components/shared/loading-screen';

export function LegacyRedirect() {
  const { t } = useTranslation();
  const location = useLocation();
  const { contexts, activeContext, isReady, getDefaultRoute } = useWorkspace();
  const isRecovering = useEmptyWorkspaceRecovery(contexts.length, isReady);

  if (!isReady || isRecovering) {
    return <LoadingScreen message={t('shared.auth.loadingWorkspace')} />;
  }

  if (contexts.length === 0) {
    return <Navigate to="/app/no-access" replace />;
  }

  if (location.pathname === '/') {
    const targetContext = activeContext ?? contexts[0].contextKey;
    return <Navigate to={getDefaultRoute(targetContext)} replace />;
  }

  for (const entry of ROUTE_MANIFEST) {
    for (const legacyPath of entry.legacyPaths ?? []) {
      const match = matchPath({ path: legacyPath, end: true }, location.pathname);
      if (match) {
        const canAccessContext = contexts.some((c) => c.contextKey === entry.context);
        if (!canAccessContext) {
          const fallback = activeContext ?? contexts[0].contextKey;
          return <Navigate to={getDefaultRoute(fallback)} replace />;
        }
        const resolved = Object.entries(match.params).reduce((acc, [key, value]) => {
          return acc.replace(`:${key}`, value ?? '');
        }, entry.path);
        return <Navigate to={resolved} replace />;
      }
    }
  }

  return <Navigate to="/app/choose-context" replace />;
}
