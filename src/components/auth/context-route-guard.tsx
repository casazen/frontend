import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { isFeatureEnabled, type FeatureFlagKey } from '@/config/feature-flags';
import type { AppContextKey } from '@/config/route-manifest';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';

interface ContextRouteGuardProps {
  contextKey: AppContextKey;
  requiredPermissions?: string[];
  /** Route behind a backend feature flag: redirects to the context home while the flag is off. */
  featureFlag?: FeatureFlagKey;
  /**
   * The same page in other contexts (plan and billing, PL-16): a user without `contextKey` who works in one of them is
   * sent there, query string included (e.g. `?checkout=success` of an old Stripe return page), instead of to a home.
   */
  alternatePaths?: Partial<Record<AppContextKey, string>>;
  children: React.ReactNode;
}

export function ContextRouteGuard({
  contextKey,
  requiredPermissions = [],
  featureFlag,
  alternatePaths,
  children,
}: ContextRouteGuardProps) {
  const { t } = useTranslation();
  const { search } = useLocation();
  const { contexts, isReady, getDefaultRoute } = useWorkspace();
  const { flags, isLoading: flagsLoading } = useFeatureFlags();
  const current = contexts.find((ctx) => ctx.contextKey === contextKey);

  if (!isReady || (featureFlag && flagsLoading)) {
    return <LoadingScreen message={t('shared.auth.loadingWorkspace')} />;
  }

  if (contexts.length === 0) {
    return <Navigate to="/app/no-access" replace />;
  }

  if (!current) {
    const alternate = contexts.map((ctx) => alternatePaths?.[ctx.contextKey]).find(Boolean);
    return <Navigate to={alternate ? `${alternate}${search}` : contexts[0].defaultRoute} replace />;
  }

  const hasAllPermissions = requiredPermissions.every((permission) => current.permissions.includes(permission));
  const featureEnabled = !featureFlag || isFeatureEnabled(flags, featureFlag);
  if (!hasAllPermissions || !featureEnabled) {
    return <Navigate to={getDefaultRoute(current.contextKey)} replace />;
  }

  return <>{children}</>;
}
