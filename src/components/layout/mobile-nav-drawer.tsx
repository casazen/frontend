import { Home } from 'lucide-react';
import {
  getDrawerNavByGroup,
  getVisibleNavEntries,
  type AppContextKey,
} from '@/config/route-manifest';
import { useWorkspace } from '@/hooks/use-workspace';
import { useUiStore } from '@/store/ui-store';
import { GroupedNavLinks } from './grouped-nav-links';
import { WorkspaceSwitcher } from './workspace-switcher';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const CONTEXT_TITLES: Record<AppContextKey, string> = {
  'short-rent': 'CASAZEN',
  'long-rent': 'CASAZEN',
  admin: 'CASAZEN Admin',
  supplier: 'CASAZEN Fornitore',
};

interface MobileNavDrawerProps {
  contextKey: AppContextKey;
}

export function MobileNavDrawer({ contextKey }: MobileNavDrawerProps) {
  const { contexts, hasPermission } = useWorkspace();
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);

  const permissionCheck = (ctx: AppContextKey, permission: string) =>
    hasPermission(ctx, permission);

  const allEntries = getVisibleNavEntries(contextKey, permissionCheck);
  const grouped = getDrawerNavByGroup(contextKey, permissionCheck);

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
        {contexts.length > 1 && (
          <div className="border-b py-3">
            <WorkspaceSwitcher layout="drawer" />
          </div>
        )}
        <nav className="flex-1 overflow-y-auto py-2">
          <GroupedNavLinks
            grouped={grouped}
            allEntries={allEntries}
            variant="drawer"
            onNavigate={() => setSidebarOpen(false)}
          />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
