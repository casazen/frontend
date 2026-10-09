import { useId, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Ellipsis } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNavCountLabel, getNavGroupLabel, getNavLabel } from '@/lib/nav-labels';
import { resolveActiveNavEntry } from '@/lib/nav-active';
import type { ContextNav, RouteManifestEntry } from '@/config/route-manifest';
import type { NavCounts } from '@/hooks/use-nav-counts';
import { NavIcon } from './nav-icon';

type NavVariant = 'sidebar' | 'drawer';

interface GroupedNavLinksProps {
  nav: ContextNav;
  /** The entries of the menus and the pages that hang from them: the open page is looked for among them. */
  matchEntries: RouteManifestEntry[];
  variant?: NavVariant;
  /** Sidebar reduced to the icons (the names stay for screen readers and as a tooltip). */
  collapsed?: boolean;
  counts?: NavCounts;
  onNavigate?: () => void;
}

const LINK_STYLES: Record<NavVariant, { row: string; active: string; inactive: string }> = {
  sidebar: {
    row: 'relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11',
    // The accent of the area: `--color-primary` is the accent while the redesign is on (UI-01), `-text` is the tone that
    // reads on the soft background. Without the redesign both are the primary of the app.
    active: 'bg-primary/10 font-semibold text-[color:var(--color-primary-text,var(--color-primary))]',
    inactive: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  },
  drawer: {
    row: 'relative flex min-h-11 items-center gap-3 px-4 py-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
    active: 'bg-primary/10 font-semibold text-[color:var(--color-primary-text,var(--color-primary))]',
    inactive: 'text-foreground hover:bg-accent',
  },
};

function NavCountPill({ entry, count, collapsed }: { entry: RouteManifestEntry; count: number; collapsed: boolean }) {
  const { t } = useTranslation();
  if (!entry.navCount || count <= 0) return null;
  return (
    <span
      data-testid="nav-count"
      className={cn(
        'ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold leading-none text-primary-foreground',
        collapsed && 'absolute right-1 top-1 ml-0 h-4 min-w-4 px-1 text-[10px]',
      )}
    >
      <span aria-hidden="true">{count > 99 ? '99+' : count}</span>
      <span className="sr-only">{`, ${getNavCountLabel(entry.navCount, count, t)}`}</span>
    </span>
  );
}

interface NavLinkItemProps {
  entry: RouteManifestEntry;
  active: boolean;
  variant: NavVariant;
  collapsed: boolean;
  count: number;
  onNavigate?: () => void;
}

function NavLinkItem({ entry, active, variant, collapsed, count, onNavigate }: NavLinkItemProps) {
  const { t } = useTranslation();
  const styles = LINK_STYLES[variant];
  const label = getNavLabel(entry, t);

  return (
    <Link
      to={entry.path}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? label : undefined}
      className={cn(styles.row, active ? styles.active : styles.inactive, collapsed && 'justify-center px-0')}
    >
      {active && variant === 'sidebar' ? (
        <span aria-hidden="true" className="absolute -left-2 bottom-2 top-2 w-[3px] rounded-full bg-primary" />
      ) : null}
      <NavIcon name={entry.icon} className="h-5 w-5 shrink-0" />
      <span className={cn('truncate', collapsed && 'sr-only')}>{label}</span>
      <NavCountPill entry={entry} count={count} collapsed={collapsed} />
    </Link>
  );
}

const GROUP_LABEL_STYLES: Record<NavVariant, string> = {
  sidebar: 'px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground',
  drawer: 'px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
};

/**
 * "Altro" of the sidebar: a disclosure. It is open while the open page is one of its entries and closed otherwise; the
 * user can open or close it, until the page changes.
 */
function NavMoreMenu({
  entries,
  activePath,
  collapsed,
  counts,
  onNavigate,
}: {
  entries: RouteManifestEntry[];
  /** `path` of the entry that stands for the open page, among those of the menus. */
  activePath: string | undefined;
  collapsed: boolean;
  counts: NavCounts;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const listId = useId();
  const [choice, setChoice] = useState<{ pathname: string; open: boolean } | null>(null);

  const activeInside = entries.some((entry) => entry.path === activePath);
  const open = choice && choice.pathname === pathname ? choice.open : activeInside;
  const label = t('nav.more');
  const styles = LINK_STYLES.sidebar;

  return (
    <div data-testid="nav-more">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        title={collapsed ? label : undefined}
        onClick={() => setChoice({ pathname, open: !open })}
        className={cn(styles.row, styles.inactive, 'w-full', collapsed && 'justify-center px-0')}
      >
        <Ellipsis className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className={cn('truncate', collapsed && 'sr-only')}>{label}</span>
        {collapsed ? null : (
          <ChevronDown
            className={cn('ml-auto h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none', open && 'rotate-180')}
            aria-hidden="true"
          />
        )}
      </button>
      <ul id={listId} hidden={!open} className="mt-0.5 flex flex-col gap-0.5">
        {entries.map((entry) => (
          <li key={entry.path}>
            <NavLinkItem
              entry={entry}
              active={entry.path === activePath}
              variant="sidebar"
              collapsed={collapsed}
              count={entry.navCount ? (counts[entry.navCount] ?? 0) : 0}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The menu of an area (UI-04a): labelled groups of at most seven primary entries and "Altro". The sidebar draws it with the
 * counters and, collapsed, only the icons; the phone menu (`variant="drawer"`) lists what the bottom bar does not and
 * shows "Altro" as one more group.
 */
export function GroupedNavLinks({
  nav,
  matchEntries,
  variant = 'sidebar',
  collapsed = false,
  counts = {},
  onNavigate,
}: GroupedNavLinksProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const baseId = useId();
  const activePath = resolveActiveNavEntry(pathname, matchEntries)?.path;
  const isDrawer = variant === 'drawer';
  const groupCount = nav.sections.length + (isDrawer && nav.more.length > 0 ? 1 : 0);
  // A single group needs no name.
  const showGroupLabels = groupCount > 1 && !collapsed;

  const renderEntry = (entry: RouteManifestEntry) => (
    <li key={entry.path}>
      <NavLinkItem
        entry={entry}
        active={entry.path === activePath}
        variant={variant}
        collapsed={collapsed}
        count={entry.navCount ? (counts[entry.navCount] ?? 0) : 0}
        onNavigate={onNavigate}
      />
    </li>
  );

  return (
    <div className={cn('flex flex-col', isDrawer ? 'gap-2 py-2' : 'gap-4')}>
      {nav.sections.map((section, index) => {
        const label = getNavGroupLabel(section.group, t);
        const labelId = `${baseId}-${section.group}`;
        return (
          <div
            key={section.group}
            role="group"
            // The heading names the group; without a heading (a single group, the icons only) the group names itself.
            aria-labelledby={showGroupLabels ? labelId : undefined}
            aria-label={showGroupLabels ? undefined : label}
            data-testid={`nav-group-${section.group}`}
            className={cn(collapsed && index > 0 && 'border-t pt-2')}
          >
            {showGroupLabels ? (
              <p id={labelId} className={GROUP_LABEL_STYLES[variant]}>
                {label}
              </p>
            ) : null}
            <ul className="flex flex-col gap-0.5">{section.entries.map(renderEntry)}</ul>
          </div>
        );
      })}
      {nav.more.length === 0 ? null : isDrawer ? (
        <div
          role="group"
          aria-labelledby={showGroupLabels ? `${baseId}-more` : undefined}
          aria-label={showGroupLabels ? undefined : t('nav.more')}
          data-testid="nav-group-more"
        >
          {showGroupLabels ? (
            <p id={`${baseId}-more`} className={GROUP_LABEL_STYLES.drawer}>
              {t('nav.more')}
            </p>
          ) : null}
          <ul className="flex flex-col gap-0.5">{nav.more.map(renderEntry)}</ul>
        </div>
      ) : (
        <div className={cn(collapsed && 'border-t pt-2')}>
          <NavMoreMenu
            entries={nav.more}
            activePath={activePath}
            collapsed={collapsed}
            counts={counts}
            onNavigate={onNavigate}
          />
        </div>
      )}
    </div>
  );
}
