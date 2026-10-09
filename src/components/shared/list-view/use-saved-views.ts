import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  SAVED_VIEWS_EVENT,
  newSavedViewId,
  parseSavedViews,
  readSavedViewsRaw,
  savedViewsKey,
  withSavedView,
  withoutSavedView,
  writeSavedViews,
  type SaveViewResult,
  type SavedView,
} from './saved-views';
import type { ListViewsScope } from './list-types';

export interface UseSavedViews {
  /** There is somebody to keep views for. Without a scope (nobody is signed in) the list offers none. */
  enabled: boolean;
  views: readonly SavedView[];
  /** Keeps the current view under a name. `ok: false` says why not (no name, the limit, the storage refused). */
  save: (name: string, query: string) => SaveViewResult | { ok: false; reason: 'storage' };
  remove: (id: string) => void;
  /** Puts a view back where it was (the "Annulla" of removing one). */
  restore: (view: SavedView, index: number) => void;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(SAVED_VIEWS_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(SAVED_VIEWS_EVENT, onChange);
  };
}

/**
 * The saved views of a list for a person in an area (see `saved-views`). It follows the storage: a view saved in another tab
 * of the same browser shows up here, and the other way round. The actions read the storage when they run, not what the
 * component last rendered: the "Annulla" of a toast is pressed seconds later, and must not undo with an old list.
 */
export function useSavedViews(listKey: string, scope: ListViewsScope | null | undefined): UseSavedViews {
  const userId = scope?.userId;
  const context = scope?.context;
  const key = useMemo(() => (userId && context ? savedViewsKey(listKey, { userId, context }) : null), [listKey, userId, context]);

  // The raw text is the snapshot: it is a string, so React can tell whether it changed.
  const raw = useSyncExternalStore(
    subscribe,
    () => (key ? readSavedViewsRaw(key) : null),
    () => null,
  );
  const views = useMemo(() => parseSavedViews(raw), [raw]);

  const save = useCallback<UseSavedViews['save']>(
    (name, query) => {
      if (!key) return { ok: false, reason: 'storage' };
      const result = withSavedView(parseSavedViews(readSavedViewsRaw(key)), { name, query }, newSavedViewId());
      if (!result.ok) return result;
      return writeSavedViews(key, result.views) ? result : { ok: false, reason: 'storage' };
    },
    [key],
  );

  const remove = useCallback(
    (id: string) => {
      if (key) writeSavedViews(key, withoutSavedView(parseSavedViews(readSavedViewsRaw(key)), id));
    },
    [key],
  );

  const restore = useCallback(
    (view: SavedView, index: number) => {
      if (!key) return;
      const current = parseSavedViews(readSavedViewsRaw(key));
      if (current.some((existing) => existing.id === view.id)) return;
      const next = [...current];
      next.splice(Math.min(index, next.length), 0, view);
      writeSavedViews(key, next);
    },
    [key],
  );

  return { enabled: key !== null, views, save, remove, restore };
}
