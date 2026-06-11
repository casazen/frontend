import type { RouteManifestEntry } from '@/config/route-manifest';

const EXACT_MATCH_PATHS = new Set([
  '/app/short-rent',
  '/app/admin',
  '/app/long-rent/leases',
]);

/**
 * Returns true when `entry` should appear selected for `pathname`.
 * Prevents parent routes (e.g. Prenotazioni) from staying active when a more
 * specific sibling nav route matches (e.g. Calendario under /bookings/calendar).
 */
export function isNavEntryActive(
  pathname: string,
  entry: RouteManifestEntry,
  navEntries: RouteManifestEntry[],
): boolean {
  if (EXACT_MATCH_PATHS.has(entry.path)) {
    return pathname === entry.path;
  }

  if (pathname === entry.path) {
    return true;
  }

  if (!pathname.startsWith(`${entry.path}/`)) {
    return false;
  }

  return !navEntries.some(
    (other) =>
      other.path !== entry.path &&
      other.path.length > entry.path.length &&
      other.path.startsWith(`${entry.path}/`) &&
      (pathname === other.path || pathname.startsWith(`${other.path}/`)),
  );
}
