import { useCallback, useSyncExternalStore } from 'react';
import { FAVORITES_CHANGED_EVENT, readFavorites, removeFavorite, toggleFavorite } from './favorites-store';

const NONE: readonly string[] = [];

function subscribe(onChange: () => void): () => void {
  window.addEventListener(FAVORITES_CHANGED_EVENT, onChange);
  // Another tab of the same browser saved or forgot a home.
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(FAVORITES_CHANGED_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * The homes the guest saved on a booking site (DB-02b), live: every heart of the page and the counter in the header follow a
 * change made by any of them, in this tab or in another. Without a site (a page that is not one) the list is empty and the
 * actions do nothing.
 */
export function useFavorites(site: string | undefined) {
  const ids = useSyncExternalStore(
    subscribe,
    () => (site ? readFavorites(site) : NONE),
    () => NONE,
  );

  /** Saves or forgets a home; returns true when it is saved now. */
  const toggle = useCallback((propertyId: string) => (site ? toggleFavorite(site, propertyId) : false), [site]);
  const remove = useCallback(
    (propertyId: string) => {
      if (site) removeFavorite(site, propertyId);
    },
    [site],
  );

  return { ids, toggle, remove };
}
