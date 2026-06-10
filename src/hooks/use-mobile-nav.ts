import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getPrimaryNavEntries,
  getSecondaryNavEntries,
  type AppContextKey,
  type RouteManifestEntry,
} from '@/config/route-manifest';
import { useWorkspace } from '@/hooks/use-workspace';
import { useUiStore } from '@/store/ui-store';

export type MobileNavTabId = string | 'more';

function isBookingsActive(pathname: string): boolean {
  return (
    pathname.startsWith('/app/short-rent/bookings') &&
    !pathname.startsWith('/app/short-rent/bookings/calendar')
  );
}

function isRouteActive(pathname: string, entry: RouteManifestEntry): boolean {
  const exact = entry.path === '/app/short-rent' || entry.path === '/app/admin';
  if (exact) {
    return pathname === entry.path;
  }
  return pathname === entry.path || pathname.startsWith(`${entry.path}/`);
}

export function useMobileNav(contextKey: AppContextKey) {
  const location = useLocation();
  const { hasPermission } = useWorkspace();
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);

  const permissionCheck = (ctx: AppContextKey, permission: string) =>
    hasPermission(ctx, permission);

  const primaryEntries = getPrimaryNavEntries(contextKey, permissionCheck);
  const secondaryEntries = getSecondaryNavEntries(contextKey, permissionCheck);
  const hasSecondary = secondaryEntries.length > 0;

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  const resolveActiveTab = (): MobileNavTabId => {
    const pathname = location.pathname;

    if (contextKey === 'short-rent') {
      if (pathname === '/app/short-rent') return '/app/short-rent';
      if (isBookingsActive(pathname)) return '/app/short-rent/bookings';
      if (pathname.startsWith('/app/short-rent/properties')) return '/app/short-rent/properties';

      const secondaryMatch = secondaryEntries.some((entry) => isRouteActive(pathname, entry));
      if (secondaryMatch || sidebarOpen) return 'more';
      return primaryEntries[0]?.path ?? 'more';
    }

    for (const entry of primaryEntries) {
      if (isRouteActive(pathname, entry)) {
        return entry.path;
      }
    }

    if (hasSecondary && (sidebarOpen || secondaryEntries.some((e) => isRouteActive(pathname, e)))) {
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
