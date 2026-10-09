import type { ListViewsScope } from './list-types';

/**
 * The views a person saves on a list ("Arrivi della settimana": a search, filters, an order, columns), kept in the browser
 * (UI-14). There is no server for them: they follow the person only on the computer and in the browser where they were saved.
 *
 * - One entry of `localStorage` per person, area and list; a person never reads another's (the key has the user), and an area's
 *   list never shows the views of another area.
 * - The entry has a version: a shape that changes bumps `SAVED_VIEWS_VERSION` and the old entries are simply not read.
 * - There is a limit (`SAVED_VIEWS_LIMIT`), and names and queries are cut to a size, so the storage cannot grow without end.
 * - Whatever is read is checked. Storage may be missing, full or hold something else (a hand-edited value, an old version):
 *   then there are no saved views and the list works as if the feature was not there. Nothing here throws.
 *
 * A view holds the query string of the list (see `list-state`), without the page. A search text is part of it: it stays in the
 * browser of the person who typed it, under their user, and is not sent anywhere.
 */

export const SAVED_VIEWS_VERSION = 1;
export const SAVED_VIEWS_LIMIT = 12;
export const SAVED_VIEW_NAME_MAX = 40;
const QUERY_MAX = 800;
/** Fired on `window` after a write: the `storage` event only reaches the other tabs. */
export const SAVED_VIEWS_EVENT = 'casazen:list-views-changed';

export interface SavedView {
  id: string;
  name: string;
  /** The query string of the view, as `listStateToParams` writes it (`chip=arrivals&sort=from:asc`). */
  query: string;
}

export function savedViewsKey(listKey: string, scope: ListViewsScope): string {
  return ['casazen', 'list-views', `v${SAVED_VIEWS_VERSION}`, scope.userId, scope.context, listKey].map(encodeURIComponent).join(':');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function readSavedViewsRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The views in a stored value; whatever is not valid is left out. */
export function parseSavedViews(raw: string | null): SavedView[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== SAVED_VIEWS_VERSION || !Array.isArray(parsed.views)) return [];
    const views: SavedView[] = [];
    for (const item of parsed.views as unknown[]) {
      if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.query !== 'string') continue;
      const name = item.name.trim().slice(0, SAVED_VIEW_NAME_MAX);
      if (!item.id || !name || item.query.length > QUERY_MAX || views.some((view) => view.id === item.id)) continue;
      views.push({ id: item.id, name, query: item.query });
      if (views.length >= SAVED_VIEWS_LIMIT) break;
    }
    return views;
  } catch {
    return [];
  }
}

export type SaveViewResult = { ok: true; views: SavedView[] } | { ok: false; reason: 'empty' | 'limit' | 'too-long' };

/**
 * `views` with a new one. A name that is already there (whatever the capitals) keeps its place and takes the new query: saving
 * "again" is updating. Past the limit nothing is added, and the person is told.
 */
export function withSavedView(views: readonly SavedView[], draft: { name: string; query: string }, id: string): SaveViewResult {
  const name = draft.name.trim().slice(0, SAVED_VIEW_NAME_MAX);
  if (!name) return { ok: false, reason: 'empty' };
  if (draft.query.length > QUERY_MAX) return { ok: false, reason: 'too-long' };
  const same = views.find((view) => view.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (same) return { ok: true, views: views.map((view) => (view === same ? { ...view, query: draft.query } : view)) };
  if (views.length >= SAVED_VIEWS_LIMIT) return { ok: false, reason: 'limit' };
  return { ok: true, views: [...views, { id, name, query: draft.query }] };
}

export function withoutSavedView(views: readonly SavedView[], id: string): SavedView[] {
  return views.filter((view) => view.id !== id);
}

/** Writes the views (an empty list removes the entry). `false` when the storage would not take them. */
export function writeSavedViews(key: string, views: readonly SavedView[]): boolean {
  try {
    if (views.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify({ version: SAVED_VIEWS_VERSION, views }));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(SAVED_VIEWS_EVENT));
  return true;
}

/** An id for a new view. */
export function newSavedViewId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `v${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}
