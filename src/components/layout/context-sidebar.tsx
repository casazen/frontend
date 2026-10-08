import { useTranslation } from 'react-i18next';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { getArea } from '@/config/areas';
import { getContextNav, getNavMatchEntries, getVisibleNavEntries, type AppContextKey } from '@/config/route-manifest';
import { useWorkspace } from '@/hooks/use-workspace';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useNavCounts } from '@/hooks/use-nav-counts';
import { useUiStore } from '@/store/ui-store';
import { cn } from '@/lib/utils';
import { AreaSwitcher } from './area-switcher';
import { GroupedNavLinks } from './grouped-nav-links';

interface ContextSidebarProps {
  contextKey: AppContextKey;
}

/**
 * The sidebar of an area (UI-04a): the area switcher, the menu (labelled groups of at most seven entries, "Altro", the
 * counters) and the button that reduces it to the icons, which the browser remembers. The name, the icon and the footer
 * line of the area come from `config/areas.ts`, the entries from the route manifest.
 */
export function ContextSidebar({ contextKey }: ContextSidebarProps) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleCollapsed = useUiStore((state) => state.toggleSidebarCollapsed);

  const area = getArea(contextKey);
  const permissionCheck = (ctx: AppContextKey, permission: string) => hasPermission(ctx, permission);
  const nav = getContextNav(contextKey, permissionCheck, flags);
  const matchEntries = getNavMatchEntries(contextKey, permissionCheck, flags);
  const counts = useNavCounts(getVisibleNavEntries(contextKey, permissionCheck, flags));

  const toggleLabel = collapsed ? t('nav.expand') : t('nav.collapse');
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const footerLabel = area.footerKey ? t(area.footerKey) : 'v1.0.0 · casazen.io';

  return (
    // Sticky to the window, as tall as the visible viewport (`dvh`), with the menu scrolling inside it: the window is
    // what scrolls in the shell (UI-03). `self-start` keeps the flex row from stretching it to the page height.
    <aside
      role="complementary"
      aria-label={t('shell.mainNavigation')}
      data-collapsed={collapsed}
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col self-start border-r bg-card transition-[width] duration-200 motion-reduce:transition-none md:flex',
        collapsed ? 'w-[4.5rem]' : 'w-64',
      )}
    >
      <div className="border-b p-3">
        <AreaSwitcher contextKey={contextKey} collapsed={collapsed} />
      </div>
      <nav
        aria-label={t('nav.menuLabel', { area: t(area.nameKey) })}
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4"
      >
        <GroupedNavLinks nav={nav} matchEntries={matchEntries} collapsed={collapsed} counts={counts} />
      </nav>
      <div className="flex flex-col gap-1 border-t p-3">
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? toggleLabel : undefined}
          data-testid="sidebar-collapse-toggle"
          className={cn(
            'flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11',
            collapsed && 'justify-center px-0',
          )}
        >
          <ToggleIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className={cn(collapsed && 'sr-only')}>{toggleLabel}</span>
        </button>
        {collapsed ? null : (
          <p className="text-center text-[10px] tracking-wide text-muted-foreground">{footerLabel}</p>
        )}
      </div>
    </aside>
  );
}
