import { Toaster } from 'sonner';
import { PHONE_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { useUiStore } from '@/store/ui-store';

/** How far from the bottom edge the toasts of a phone stay when the bottom bar is there: the bar, the home indicator, a margin. */
const ABOVE_THE_BAR = 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 0.75rem)';

/** The same when the page also has its primary action fixed above the bar (`PageHeader.mobilePrimary`): over both of them. */
const ABOVE_THE_BAR_AND_THE_PRIMARY_ACTION =
  'calc(var(--bottom-nav-height) + var(--mobile-primary-height) + env(safe-area-inset-bottom, 0px) + 0.75rem)';

/**
 * The toasts of the app (sonner). Where they always were, at the top right, except on a phone with the bottom bar (below
 * `md`, inside the shell): there they come up at the bottom, centered and above the bar, so that they neither cover the
 * header and its profile menu nor the bar, nor are covered by it (under 600 px the library makes them as wide as the
 * screen, minus its margin). A page that fixes its primary action above the bar (UI-05) raises them over it too. The public
 * pages have no bar and keep the top right, where nothing of theirs is: the booking bar of the public site and the cookie
 * notice sit at the bottom.
 */
export function AppToaster() {
  const isPhone = useMediaQuery(PHONE_QUERY);
  const barIsThere = useUiStore((state) => state.bottomBarVisible);
  const primaryActionIsThere = useUiStore((state) => state.mobilePrimaryVisible);
  const aboveTheBar = isPhone && barIsThere;
  const bottom = primaryActionIsThere ? ABOVE_THE_BAR_AND_THE_PRIMARY_ACTION : ABOVE_THE_BAR;

  return (
    <Toaster
      position={aboveTheBar ? 'bottom-center' : 'top-right'}
      // Only the bottom margin is ours, and only then: the library's own margins stay. `offset` is for a window wider than
      // 600 px, `mobileOffset` for a narrower one.
      offset={aboveTheBar ? { bottom } : undefined}
      mobileOffset={aboveTheBar ? { bottom } : undefined}
      richColors
    />
  );
}
