import { Navigate, useLocation } from 'react-router-dom';
import { ContextRouteGuard } from '@/components/auth/context-route-guard';
import type { AppContextKey } from '@/config/route-manifest';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getContextHomeRoute } from './context-home';

function ContextHomeRedirect({ contextKey }: { contextKey: AppContextKey }) {
  const { search, hash } = useLocation();
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();

  const home = getContextHomeRoute(contextKey, hasPermission, flags);
  return <Navigate to={`${home}${search}${hash}`} replace />;
}

/**
 * Index route of an area that has no page at its bare address: it opens the home of the area instead of an empty shell.
 * The guard comes first, so that a user who is not in this area, or whose workspace is still loading, is treated as for
 * any other page of the area.
 */
export function ContextIndexRoute({ contextKey }: { contextKey: AppContextKey }) {
  return (
    <ContextRouteGuard contextKey={contextKey}>
      <ContextHomeRedirect contextKey={contextKey} />
    </ContextRouteGuard>
  );
}
