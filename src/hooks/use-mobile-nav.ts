import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getPrimaryNavEntries,
  getSecondaryNavEntries,
  getVisibleNavEntries,
  type AppContextKey,
} from '@/config/route-manifest';
import { isNavEntryActive } from '@/lib/nav-active';
import { useWorkspace } from '@/hooks/use-workspace';
import { useUiStore } from '@/store/ui-store';

export type MobileNavTabId = string | 'more';

export function useMobileNav(contextKey: AppContextKey) {
  const location = useLocation();
  const { hasPermission } = useWorkspace();
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);

  const permissionCheck = (ctx: AppContextKey, permission: string) =>
    hasPermission(ctx, permission);

  const allEntries = getVisibleNavEntries(contextKey, permissionCheck);
  const primaryEntries = getPrimaryNavEntries(contextKey, permissionCheck);
  const secondaryEntries = getSecondaryNavEntries(contextKey, permissionCheck);
  const hasSecondary = secondaryEntries.length > 0;

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  const resolveActiveTab = (): MobileNavTabId => {
    const pathname = location.pathname;

    const activePrimary = primaryEntries.find((entry) =>
      isNavEntryActive(pathname, entry, allEntries),
    );
    if (activePrimary) {
      return activePrimary.path;
    }

    const onSecondary = secondaryEntries.some((entry) =>
      isNavEntryActive(pathname, entry, allEntries),
    );
    if (onSecondary || sidebarOpen) {
      return 'more';
    }

    return primaryEntries[0]?.path ?? 'more';
  };

  return {
    primaryEntries,
    secondaryEntries,
    hasSecondary,
    activeTab: resolveActiveTab(),
    sidebarOpen,
    setSidebarOpen,
  };
}
