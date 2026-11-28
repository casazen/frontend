import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { isFeatureRuleEnabled, type FeatureFlagRule } from '@/config/feature-flags';
import type { AppContextKey } from '@/config/route-manifest';
import { searchWithoutOctorateCallback } from '@/features/integrations/octorate/octorate-callback';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getContextHomeRoute } from '@/routes/context-home';
import { ReservedPage } from './reserved-page';

interface ContextRouteGuardProps {
  contextKey: AppContextKey;
  requiredPermissions?: string[];
  permissionMode?: 'any';
  featureFlag?: FeatureFlagRule;
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
  permissionMode,
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
    return <LoadingScreen message={t('shared.auth.loadingWorkspace')} className="h-auto flex-1" />;
  }

  if (contexts.length === 0) {
    return <Navigate to="/app/no-access" replace />;
  }

  if (!current) {
    const alternate = contexts.map((ctx) => alternatePaths?.[ctx.contextKey]).find(Boolean);
    return <Navigate to={alternate ? `${alternate}${search}` : contexts[0].defaultRoute} replace />;
  }

  const featureEnabled = isFeatureRuleEnabled(flags, featureFlag);
  if (!featureEnabled) {
    return <Navigate to={getDefaultRoute(current.contextKey)} replace />;
  }

  // The user is in the area but the role lacks the permission of this page (UI-03): say so, instead of a silent redirect.
  const hasRequiredPermission = (permission: string) => current.permissions.includes(permission);
  const allowed = permissionMode === 'any' ? requiredPermissions.some(hasRequiredPermission) : requiredPermissions.every(hasRequiredPermission);
  if (!allowed) {
    if (homeWhenDenied) {
      const home = getContextHomeRoute(current.contextKey, hasPermission, flags);
      if (home !== pathname) return <Navigate to={`${home}${search}${hash}`} replace />;
    }
    const kept = searchWithoutOctorateCallback(pathname, search);
    if (kept !== search) return <Navigate to={{ pathname, search: kept, hash }} replace />;
    return <ReservedPage contextKey={current.contextKey} homePath={getDefaultRoute(current.contextKey)} />;
  }

  return <>{children}</>;
}
