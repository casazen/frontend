import { useTranslation } from 'react-i18next';
import { Home } from 'lucide-react';
import { getArea } from '@/config/areas';
import { getContextNav, getNavMatchEntries, type AppContextKey } from '@/config/route-manifest';
import { useWorkspace } from '@/hooks/use-workspace';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useUiStore } from '@/store/ui-store';
import { AreaSwitcher } from './area-switcher';
import { GroupedNavLinks } from './grouped-nav-links';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface MobileNavDrawerProps {
  contextKey: AppContextKey;
  /** The organization of the user, shown under the name of the area. */
  organizationName?: string | null;
}

/**
 * The menu of the phone, opened by the hamburger of the header or by "Altro" of the bottom bar: the area switcher and
 * what the bottom bar does not list (UI-04b redraws it as a sheet from the bottom).
 */
export function MobileNavDrawer({ contextKey, organizationName = null }: MobileNavDrawerProps) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);

  const CONTEXT_TITLES: Record<AppContextKey, string> = {
    'short-rent': t('nav.brandShort'),
    'long-rent': t('nav.brandShort'),
    admin: t('nav.brandAdmin'),
    supplier: t('nav.brandSupplier'),
  };

  const permissionCheck = (ctx: AppContextKey, permission: string) =>
    hasPermission(ctx, permission);

  const nav = getContextNav(contextKey, permissionCheck, flags, { withoutBottom: true });
  const matchEntries = getNavMatchEntries(contextKey, permissionCheck, flags);

  return (
    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <SheetContent side="left" className="md:hidden w-[min(20rem,85vw)]">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center gap-2.5 pr-8">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Home className="h-4 w-4" />
            </div>
            <SheetTitle>{CONTEXT_TITLES[contextKey]}</SheetTitle>
          </div>
        </SheetHeader>
        <div className="border-b p-3">
          <AreaSwitcher contextKey={contextKey} organizationName={organizationName} />
        </div>
        <nav aria-label={t('nav.menuLabel', { area: t(getArea(contextKey).nameKey) })} className="flex-1 overflow-y-auto py-2">
          <GroupedNavLinks nav={nav} matchEntries={matchEntries} variant="drawer" onNavigate={() => setSidebarOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
