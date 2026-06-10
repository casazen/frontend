import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNavIcon } from '@/lib/nav-icons';
import { getNavGroupLabel, getNavLabel } from '@/lib/nav-labels';
import {
  NAV_GROUP_ORDER,
  getDrawerNavByGroup,
  type AppContextKey,
} from '@/config/route-manifest';
import { useWorkspace } from '@/hooks/use-workspace';
import { useUiStore } from '@/store/ui-store';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const CONTEXT_TITLES: Record<AppContextKey, string> = {
  'short-rent': 'CASAZEN',
  'long-rent': 'CASAZEN',
  admin: 'CASAZEN Admin',
};

interface MobileNavDrawerProps {
  contextKey: AppContextKey;
}

export function MobileNavDrawer({ contextKey }: MobileNavDrawerProps) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);

  const permissionCheck = (ctx: AppContextKey, permission: string) =>
    hasPermission(ctx, permission);

  const grouped = getDrawerNavByGroup(contextKey, permissionCheck);
  const visibleGroups = NAV_GROUP_ORDER.filter((group) => grouped.has(group));

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
        <nav className="flex-1 overflow-y-auto py-2">
          {visibleGroups.map((group) => {
            const entries = grouped.get(group) ?? [];
            return (
              <div key={group} className="mb-4">
                <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {getNavGroupLabel(group, t)}
                </p>
                {entries.map((entry) => {
                  const Icon = getNavIcon(entry.icon);
                  return (
                    <NavLink
                      key={entry.path}
                      to={entry.path}
                      end={entry.path === `/app/${contextKey === 'admin' ? 'admin' : contextKey}`}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex min-h-11 items-center gap-3 px-4 py-3 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground hover:bg-accent',
                        )
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {getNavLabel(entry, t)}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
