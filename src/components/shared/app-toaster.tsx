import { Toaster } from 'sonner';
import { PHONE_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { useUiStore } from '@/store/ui-store';

/** How far from the bottom edge the toasts of a phone stay when the bottom bar is there: the bar, the home indicator, a margin. */
const ABOVE_THE_BAR = 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 0.75rem)';

/**
 * The toasts of the app (sonner). Where they always were, at the top right, except on a phone with the bottom bar (below
 * `md`, inside the shell): there they come up at the bottom, centered and above the bar, so that they neither cover the
 * header and its menu button nor the bar, nor are covered by it (under 600 px the library makes them as wide as the screen,
 * minus its margin). The public pages have no bar and keep the top right, where nothing of theirs is: the booking bar of
 * the public site and the cookie notice sit at the bottom.
 */
export function AppToaster() {
  const isPhone = useMediaQuery(PHONE_QUERY);
  const barIsThere = useUiStore((state) => state.bottomBarVisible);
  const aboveTheBar = isPhone && barIsThere;

  return (
    <Toaster
      position={aboveTheBar ? 'bottom-center' : 'top-right'}
      // Only the bottom margin is ours, and only then: the library's own margins stay. `offset` is for a window wider than
      // 600 px, `mobileOffset` for a narrower one.
      offset={aboveTheBar ? { bottom: ABOVE_THE_BAR } : undefined}
      mobileOffset={aboveTheBar ? { bottom: ABOVE_THE_BAR } : undefined}
      richColors
    />
  );
}
