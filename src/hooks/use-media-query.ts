import { useCallback, useSyncExternalStore } from 'react';

export const PHONE_QUERY = '(width < 48rem)';
export const FROM_TABLET_QUERY = '(width >= 48rem)';
export const FROM_DESKTOP_QUERY = '(width >= 64rem)';
export const FROM_WIDE_QUERY = '(width >= 96rem)';
export const TABLET_QUERY = '(width >= 48rem) and (width < 64rem)';

function matchMedia(query: string): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(query);
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = matchMedia(query);
      list?.addEventListener('change', onChange);
      return () => list?.removeEventListener('change', onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => matchMedia(query)?.matches ?? false, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
