/**
 * The homes a guest saved with the heart (DB-02b): a list of property ids for each booking site, kept on the device (the local
 * storage of the browser). No account, nothing sent anywhere: it is the memory the guest asked for by tapping the heart, a
 * functional one, and the cookie notice says so ("le case che salvi"). Most recent first, at most `MAX_FAVORITES`.
 */

const KEY_PREFIX = 'casazen.favorites.';

/** Enough to compare a good few homes; a list that never stops growing is not a favourites list. */
export const MAX_FAVORITES = 50;

/** Fired on `window` when the list of a site changes in this tab, so that every heart and the counter follow. */
export const FAVORITES_CHANGED_EVENT = 'casazen:favorites-changed';

const EMPTY: readonly string[] = [];

/** What was read last for each site, so that an unchanged list is the very same array (a stable snapshot for React). */
const lastRead = new Map<string, { raw: string | null; ids: readonly string[] }>();

function storageKey(site: string): string {
  return `${KEY_PREFIX}${site}`;
}

function parseIds(raw: string | null): readonly string[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const ids = parsed.filter((value): value is string => typeof value === 'string' && value.length > 0 && value.length <= 64);
    return ids.length === 0 ? EMPTY : [...new Set(ids)].slice(0, MAX_FAVORITES);
  } catch {
    return EMPTY;
  }
}

/** The ids saved for a site (a list that is never changed in place), empty when none or when the browser keeps no memory. */
export function readFavorites(site: string): readonly string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(storageKey(site));
  } catch {
    return EMPTY;
  }
  const previous = lastRead.get(site);
  if (previous && previous.raw === raw) return previous.ids;
  const ids = parseIds(raw);
  lastRead.set(site, { raw, ids });
  return ids;
}

function writeFavorites(site: string, ids: readonly string[]): void {
  try {
    if (ids.length === 0) window.localStorage.removeItem(storageKey(site));
    else window.localStorage.setItem(storageKey(site), JSON.stringify(ids));
  } catch {
    // The browser keeps no memory (private mode, full): the heart does nothing, the page still works.
  }
  window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
}

/** Saves the home if it is not saved, forgets it if it is. Returns true when it is saved now. */
export function toggleFavorite(site: string, propertyId: string): boolean {
  const current = readFavorites(site);
  if (current.includes(propertyId)) {
    writeFavorites(site, current.filter((id) => id !== propertyId));
    return false;
  }
  writeFavorites(site, [propertyId, ...current].slice(0, MAX_FAVORITES));
  return true;
}

/** Forgets a home. */
export function removeFavorite(site: string, propertyId: string): void {
  const current = readFavorites(site);
  if (current.includes(propertyId)) writeFavorites(site, current.filter((id) => id !== propertyId));
}
