import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('scroll', onChange, { passive: true });
  return () => window.removeEventListener('scroll', onChange);
}

/**
 * True once the page has been scrolled past `threshold` pixels: the header that floats over the cover turns solid. Read from the
 * window as an external store, so a scroll that stays on one side of the line draws nothing.
 */
export function useScrolled(threshold = 24): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.scrollY > threshold,
    () => false,
  );
}
