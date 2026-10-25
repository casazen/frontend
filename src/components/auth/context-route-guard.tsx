import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { isFeatureEnabled, type FeatureFlagKey } from '@/config/feature-flags';
import type { AppContextKey } from '@/config/route-manifest';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getContextHomeRoute } from '@/routes/context-home';
import { ReservedPage } from './reserved-page';

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
  /**
   * The page is the one at the bare address of the area (the Panoramica, LR-05): a role that lacks its permission is sent to the
   * first page of the area it can open, as the bare address did when it only redirected, instead of being told "no" at the door
   * of the area. Only when there is such a page; otherwise the role is told, as for any page.
   */
  homeWhenDenied?: boolean;
  children: React.ReactNode;
}

export function ContextRouteGuard({
  contextKey,
  requiredPermissions = [],
  featureFlag,
  alternatePaths,
  homeWhenDenied = false,
  children,
}: ContextRouteGuardProps) {
  const { t } = useTranslation();
  const { pathname, search, hash } = useLocation();
  const { contexts, isReady, getDefaultRoute, hasPermission } = useWorkspace();
  const { flags, isLoading: flagsLoading } = useFeatureFlags();
  const current = contexts.find((ctx) => ctx.contextKey === contextKey);

  if (!isReady || (featureFlag && flagsLoading)) {
    // Inside the content region of the shell: the spinner fills it, not the viewport.
    return <LoadingScreen message={t('shared.auth.loadingWorkspace')} className="h-auto flex-1" />;
  }

  if (contexts.length === 0) {
    return <Navigate to="/app/no-access" replace />;
  }

  if (!current) {
    const alternate = contexts.map((ctx) => alternatePaths?.[ctx.contextKey]).find(Boolean);
    return <Navigate to={alternate ? `${alternate}${search}` : contexts[0].defaultRoute} replace />;
  }

  // A page behind a flag that is off does not exist yet, for anyone: back to the home of the area.
  const featureEnabled = !featureFlag || isFeatureEnabled(flags, featureFlag);
  if (!featureEnabled) {
    return <Navigate to={getDefaultRoute(current.contextKey)} replace />;
  }

  // The user is in the area but the role lacks the permission of this page (UI-03): say so, instead of a silent redirect.
  const hasAllPermissions = requiredPermissions.every((permission) => current.permissions.includes(permission));
  if (!hasAllPermissions) {
    if (homeWhenDenied) {
      const home = getContextHomeRoute(current.contextKey, hasPermission, flags);
      if (home !== pathname) return <Navigate to={`${home}${search}${hash}`} replace />;
    }
    return <ReservedPage contextKey={current.contextKey} homePath={getDefaultRoute(current.contextKey)} />;
  }

  return <>{children}</>;
}
