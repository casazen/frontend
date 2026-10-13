import type { AppContextKey } from '@/config/route-manifest';

/**
 * The items chosen in the palette, to offer them again (UI-06). Privacy first:
 * - what is kept is the `id` of the item and nothing else: no label, so no name of a guest, and never the text that was typed;
 * - it is kept in this browser (`localStorage`), for one user in one area; another user, or the same one in another area,
 *   never reads it;
 * - an item is looked up again by its `id` among the items that exist now: one that is gone (a booking no longer in the
 *   cache, a page the role lost) is simply not shown.
 * Every access may throw (private mode, blocked storage, full quota): then nothing is remembered and the palette works as if
 * there were no recents.
 */
const KEY_PREFIX = 'casazen:palette:recent';
const MAX_RECENTS = 8;

export interface RecentScope {
  userId: string;
  area: AppContextKey;
}

export function recentsKey(scope: RecentScope): string {
  return `${KEY_PREFIX}:${encodeURIComponent(scope.userId)}:${encodeURIComponent(scope.area)}`;
}

/** The `id`s chosen before in `scope`, the latest first. Nothing wrong in the storage makes this throw. */
export function readRecents(scope: RecentScope): string[] {
  try {
    const raw = localStorage.getItem(recentsKey(scope));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id !== '').slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

/** Puts `id` first among the recents of `scope` (it was just chosen) and forgets the oldest beyond {@link MAX_RECENTS}. */
export function rememberRecent(scope: RecentScope, id: string): void {
  try {
    const next = [id, ...readRecents(scope).filter((known) => known !== id)].slice(0, MAX_RECENTS);
    localStorage.setItem(recentsKey(scope), JSON.stringify(next));
  } catch {
    // Not remembered: nothing else depends on it.
  }
}
