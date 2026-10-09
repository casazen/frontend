import {
  getDefaultRoute,
  getManifestEntry,
  getVisibleNavEntries,
  hasEntryPermission,
  isEntryFeatureEnabled,
  type AppContextKey,
  type PermissionPredicate,
} from '@/config/route-manifest';
import type { FeatureFlags } from '@/config/feature-flags';

/**
 * Where the bare address of an area opens (`/app/long-rent`, `/app/supplier`): the default page of the area (contracts for
 * long-rent, the dashboard for suppliers) when the user can open it, otherwise the first page of the area's menu that the
 * user can open. With nothing the user can open, the default page anyway: its own guard says what is missing.
 */
export function getContextHomeRoute(
  contextKey: AppContextKey,
  hasPermission: PermissionPredicate,
  features: Partial<FeatureFlags>,
): string {
  const defaultRoute = getDefaultRoute(contextKey);
  const home = getManifestEntry(defaultRoute);
  if (home && hasEntryPermission(home, hasPermission) && isEntryFeatureEnabled(home, features)) {
    return defaultRoute;
  }
  return getVisibleNavEntries(contextKey, hasPermission, features)[0]?.path ?? defaultRoute;
}
