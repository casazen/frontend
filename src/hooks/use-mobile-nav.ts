import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getBottomNavEntries,
  getNavMatchEntries,
  getVisibleNavEntries,
  type AppContextKey,
} from '@/config/route-manifest';
import { resolveActiveNavEntry } from '@/lib/nav-active';
import { useWorkspace } from '@/hooks/use-workspace';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useUiStore } from '@/store/ui-store';

export type MobileNavTabId = string | 'more';

/**
 * What the bottom bar of the phone shows (UI-04a): the destinations the manifest marks with `navBottom` (at most four) and
 * "Altro", which opens the menu with everything else. The tab of the open page is its destination, or "Altro" when the
 * page is not one of them. UI-04b redraws the bar and the menu.
 */
export function useMobileNav(contextKey: AppContextKey) {
  const location = useLocation();
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);

  const permissionCheck = (ctx: AppContextKey, permission: string) =>
    hasPermission(ctx, permission);

  const bottomEntries = getBottomNavEntries(contextKey, permissionCheck, flags);
  const matchEntries = getNavMatchEntries(contextKey, permissionCheck, flags);
  const hasMore = getVisibleNavEntries(contextKey, permissionCheck, flags).some(
    (entry) => entry.navBottom === undefined,
  );

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  const resolveActiveTab = (): MobileNavTabId => {
    const active = resolveActiveNavEntry(location.pathname, matchEntries);
    const onBar = bottomEntries.find((entry) => entry.path === active?.path);
    if (onBar) {
      return onBar.path;
    }
    // A page that is not a bar destination — one of "Altro", or a page in no menu, such as plan and billing —
    // marks "Altro", including while the drawer is closed.
    return 'more';
  };

  return {
    bottomEntries,
    hasMore,
    activeTab: resolveActiveTab(),
    sidebarOpen,
    setSidebarOpen,
  };
}
