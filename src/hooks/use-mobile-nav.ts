import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getAccessibleAreas } from '@/config/areas';
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
 * What the bottom bar of the phone shows (UI-04a/UI-04b): the destinations the manifest marks with `navBottom` (at most
 * four) and "Altro", which opens the sheet with everything else and the area switcher. The tab of the open page is its
 * destination; any other page (one of "Altro", or one that is in no menu) is "Altro".
 *
 * "Altro" is there when the sheet has something to show: entries the bar does not list, or other areas to go to. The sheet
 * is open while `sidebarOpen` is set (the header opens it too, with its menu button) and closes by itself when the page
 * changes.
 */
export function useMobileNav(contextKey: AppContextKey) {
  const location = useLocation();
  const { contexts, hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);

  const permissionCheck = (ctx: AppContextKey, permission: string) =>
    hasPermission(ctx, permission);

  const bottomEntries = getBottomNavEntries(contextKey, permissionCheck, flags);
  const matchEntries = getNavMatchEntries(contextKey, permissionCheck, flags);
  const hasMore =
    getVisibleNavEntries(contextKey, permissionCheck, flags).some((entry) => entry.navBottom === undefined) ||
    getAccessibleAreas(contexts).length > 1;

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  const resolveActiveTab = (): MobileNavTabId => {
    const active = resolveActiveNavEntry(location.pathname, matchEntries);
    const onBar = bottomEntries.find((entry) => entry.path === active?.path);
    return onBar ? onBar.path : 'more';
  };

  return {
    bottomEntries,
    hasMore,
    activeTab: resolveActiveTab(),
    sidebarOpen,
    setSidebarOpen,
  };
}
