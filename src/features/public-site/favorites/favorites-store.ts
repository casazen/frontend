const KEY_PREFIX = 'casazen.favorites.';

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

export function toggleFavorite(site: string, propertyId: string): boolean {
  const current = readFavorites(site);
  if (current.includes(propertyId)) {
    writeFavorites(site, current.filter((id) => id !== propertyId));
    return false;
  }
  writeFavorites(site, [propertyId, ...current].slice(0, MAX_FAVORITES));
  return true;
}

export function removeFavorite(site: string, propertyId: string): void {
  const current = readFavorites(site);
  if (current.includes(propertyId)) writeFavorites(site, current.filter((id) => id !== propertyId));
}
