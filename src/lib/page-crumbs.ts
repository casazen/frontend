import type { TFunction } from 'i18next';
import { matchPath } from 'react-router-dom';
import type { FeatureFlags } from '@/config/feature-flags';
import {
  ROUTE_MANIFEST,
  getDefaultRoute,
  getManifestEntry,
  hasEntryPermission,
  isEntryFeatureEnabled,
  type AppContextKey,
  type PermissionPredicate,
  type RouteManifestEntry,
} from '@/config/route-manifest';
import { getNavLabel } from '@/lib/nav-labels';

/** A step of the trail that leads to a page (breadcrumb): the last one is the page itself and has no address. */
export interface PageCrumb {
  label: string;
  to?: string;
}

/** An entry has a name to show in a trail when the menus have one for it. */
function isNamed(entry: RouteManifestEntry): boolean {
  return Boolean(entry.navKey ?? entry.navLabel);
}

/** `/app/x/:id` is a record of the list, not a place with a name of its own. */
function hasParameters(entry: RouteManifestEntry): boolean {
  return entry.path.includes(':');
}

function dynamicSegments(entry: RouteManifestEntry): number {
  return entry.path.split('/').filter((segment) => segment.startsWith(':')).length;
}

/** The entry of the manifest that is the page at `pathname`: the one with the fewest parameters when several fit. */
function findEntry(contextKey: AppContextKey, pathname: string): RouteManifestEntry | undefined {
  return ROUTE_MANIFEST.filter(
    (entry) => entry.context === contextKey && matchPath({ path: entry.path, end: true }, pathname) !== null,
  ).sort((a, b) => dynamicSegments(a) - dynamicSegments(b) || b.path.length - a.path.length)[0];
}

/**
 * The page one step up from `entry`: the one it hangs from in the menus (`navParent`), otherwise the closest named page whose
 * address is the start of its own (`/payments` for `/payments/:id`). The home of the area is not one: the trail starts there.
 */
function findParent(entry: RouteManifestEntry): RouteManifestEntry | undefined {
  if (entry.navParent) return getManifestEntry(entry.navParent);

  const home = getDefaultRoute(entry.context);
  return ROUTE_MANIFEST.filter(
    (candidate) =>
      candidate.context === entry.context &&
      candidate.path !== home &&
      isNamed(candidate) &&
      !hasParameters(candidate) &&
      entry.path.startsWith(`${candidate.path}/`),
  ).sort((a, b) => b.path.length - a.path.length)[0];
}

interface ManifestCrumbsOptions {
  contextKey: AppContextKey;
  pathname: string;
  /** The name of the page that is open (the title of the page): the last step of the trail. */
  current: string;
  t: TFunction;
  /** Without them every page of the trail is offered: the caller that knows the user passes what the user may open. */
  hasPermission?: PermissionPredicate;
  features?: Partial<FeatureFlags>;
}

/**
 * The trail to the page at `pathname`, read from the route manifest (UI-05): the pages above it, named as the menus name
 * them, each with its address, and the page itself last. Nothing for a page that has nothing above it (the home of an area
 * and its menu pages have no trail), nor for an address the manifest does not know. A page above that the user may not open
 * is left out, so is one with a parameter in its address (it is a record, not a place); a page that needs more can pass its
 * crumbs to `PageHeader`.
 *
 * The area is not part of it: the page header puts it first.
 */
export function getManifestCrumbs({
  contextKey,
  pathname,
  current,
  t,
  hasPermission,
  features,
}: ManifestCrumbsOptions): PageCrumb[] {
  const page = findEntry(contextKey, pathname);
  if (!page) return [];

  const above: RouteManifestEntry[] = [];
  const seen = new Set([page.path]);
  for (let step = findParent(page); step && !seen.has(step.path); step = findParent(step)) {
    seen.add(step.path);
    above.unshift(step);
  }

  const reachable = above.filter(
    (entry) => isNamed(entry) && hasEntryPermission(entry, hasPermission) && isEntryFeatureEnabled(entry, features),
  );
  if (reachable.length === 0) return [];

  return [...reachable.map((entry) => ({ label: getNavLabel(entry, t), to: entry.path })), { label: current }];
}
