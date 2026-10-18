import { useCallback, useSyncExternalStore } from 'react';

/**
 * The breakpoints of the shell, written as Tailwind writes them (`md` = 48rem, `lg` = 64rem, range syntax): what a CSS
 * class decides at one of these widths, a component that has to know it in code decides at the same one.
 */
export const PHONE_QUERY = '(width < 48rem)';
/** At or above `md`: where the sidebar and the header take the place of the bottom bar. */
export const FROM_TABLET_QUERY = '(width >= 48rem)';
/** Between `md` and `lg`: the sidebar is a rail of icons. */
export const TABLET_QUERY = '(width >= 48rem) and (width < 64rem)';

function matchMedia(query: string): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(query);
}

/**
 * True while the window matches the media `query`, and it follows the window when it is resized or turned. Where the
 * browser has no `matchMedia` (an isolated test) nothing matches, so a component starts from its wide layout.
 */
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
