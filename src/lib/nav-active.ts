import type { RouteManifestEntry } from '@/config/route-manifest';

/**
 * The root pages of an area: every other page of the area starts with their address, so they are highlighted only on
 * their own page.
 */
const EXACT_MATCH_PATHS = new Set(['/app/short-rent', '/app/admin']);

function matchesPathname(pathname: string, entry: RouteManifestEntry): boolean {
  if (pathname === entry.path) return true;
  if (EXACT_MATCH_PATHS.has(entry.path)) return false;
  return pathname.startsWith(`${entry.path}/`);
}

/**
 * The entry of the menu that stands for the open page, or `undefined` when none does.
 *
 * `navEntries` holds the entries of the menus and the pages that hang from them (`navParent`). The most specific entry
 * wins, so a parent route (Prenotazioni) does not stay selected when a more specific sibling matches (Calendario under
 * /bookings/calendar). A page that hangs from an entry (Alloggiati from Adempimenti) stands for that entry, which is the
 * one highlighted; when the entry it hangs from is not among `navEntries`, the page stands for itself.
 */
export function resolveActiveNavEntry(
  pathname: string,
  navEntries: RouteManifestEntry[],
): RouteManifestEntry | undefined {
  let best: RouteManifestEntry | undefined;
  for (const entry of navEntries) {
    if (matchesPathname(pathname, entry) && (!best || entry.path.length > best.path.length)) {
      best = entry;
    }
  }
  if (!best?.navParent) return best;
  const parentPath = best.navParent;
  return navEntries.find((entry) => entry.path === parentPath && !entry.navParent) ?? best;
}

/**
 * Returns true when `entry` should appear selected for `pathname` (see {@link resolveActiveNavEntry}).
 */
export function isNavEntryActive(
  pathname: string,
  entry: RouteManifestEntry,
  navEntries: RouteManifestEntry[],
): boolean {
  return resolveActiveNavEntry(pathname, navEntries)?.path === entry.path;
}
