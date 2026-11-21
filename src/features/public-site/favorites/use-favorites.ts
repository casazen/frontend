import { useCallback, useSyncExternalStore } from 'react';
import { useEmbed } from '@/features/embed/embed-context';
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
 *
 * Inside the frame of an embeddable widget (NF-144) there are no hearts: the list is always empty and nothing reads or writes the storage of
 * the browser (the pages of `/embed/*` keep nothing there, whatever the guest saved on the booking site itself).
 */
export function useFavorites(site: string | undefined) {
  const embed = useEmbed();
  const saved = site && !embed ? site : undefined;
  const ids = useSyncExternalStore(
    subscribe,
    () => (saved ? readFavorites(saved) : NONE),
    () => NONE,
  );

  /** Saves or forgets a home; returns true when it is saved now. */
  const toggle = useCallback((propertyId: string) => (saved ? toggleFavorite(saved, propertyId) : false), [saved]);
  const remove = useCallback(
    (propertyId: string) => {
      if (saved) removeFavorite(saved, propertyId);
    },
    [saved],
  );

  return { ids, toggle, remove };
}
