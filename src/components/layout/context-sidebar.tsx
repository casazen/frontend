import type { LucideIcon } from 'lucide-react';
import { Home } from 'lucide-react';
import {
  getDesktopNavByGroup,
  getVisibleNavEntries,
  type AppContextKey,
} from '@/config/route-manifest';
import { useWorkspace } from '@/hooks/use-workspace';
import { GroupedNavLinks } from './grouped-nav-links';
import { WorkspaceSwitcher } from './workspace-switcher';

interface ContextSidebarProps {
  contextKey: AppContextKey;
  subtitle: string;
  icon?: LucideIcon;
  iconClassName?: string;
  footerLabel?: string;
}

export function ContextSidebar({
  contextKey,
  subtitle,
  icon: Icon = Home,
  iconClassName = 'bg-primary text-primary-foreground',
  footerLabel = 'v1.0.0 · casazen.io',
}: ContextSidebarProps) {
  const { contexts, hasPermission } = useWorkspace();
  const permissionCheck = (ctx: AppContextKey, permission: string) =>
    hasPermission(ctx, permission);

  const allEntries = getVisibleNavEntries(contextKey, permissionCheck);
  const grouped = getDesktopNavByGroup(contextKey, permissionCheck);

  return (
    <aside role="complementary" aria-label="Main navigation" className="hidden md:flex h-screen w-64 flex-col border-r bg-card">
      <div className="border-b px-4 py-4 space-y-3">
        <div className="flex items-center gap-2.5 px-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg shadow-sm ${iconClassName}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight">CASAZEN</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {subtitle}
            </span>
          </div>
        </div>
        {contexts.length > 1 && <WorkspaceSwitcher layout="sidebar" />}
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        <GroupedNavLinks
          grouped={grouped}
          allEntries={allEntries}
          variant="sidebar"
        />
      </nav>
      <div className="border-t p-3">
        <p className="text-center text-[10px] tracking-wide text-muted-foreground">{footerLabel}</p>
      </div>
    </aside>
  );
}
