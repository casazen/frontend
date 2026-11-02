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
import { profilePathForContext } from '@/lib/profile-path';

/**
 * The first page of the menu of an area that the user can open; failing that, the profile of the area. The profile asks for no
 * permission and is in the menu of the user (the header, the sheet of the phone), not in the menus of a rental area any more: a
 * user whom the area gives nothing else still lands on a page that opens. `undefined` when there is none.
 */
export function getFirstOpenablePage(
  contextKey: AppContextKey,
  hasPermission: PermissionPredicate,
  features: Partial<FeatureFlags>,
): string | undefined {
  const first = getVisibleNavEntries(contextKey, hasPermission, features)[0];
  if (first) return first.path;

  const profile = getManifestEntry(profilePathForContext(contextKey));
  const profileOpens =
    profile?.context === contextKey && hasEntryPermission(profile, hasPermission) && isEntryFeatureEnabled(profile, features);
  return profileOpens ? profile.path : undefined;
}

/**
 * Where the bare address of an area opens (`/app/long-rent`, `/app/supplier`): the default page of the area (the Panoramica for
 * long-rent, the dashboard for suppliers) when the user can open it, otherwise the first page of the area that the user can open
 * (`getFirstOpenablePage`). With nothing the user can open, the default page anyway: its own guard says what is missing.
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
  return getFirstOpenablePage(contextKey, hasPermission, features) ?? defaultRoute;
}
