import { useId, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Ellipsis } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNavGroupLabel, getNavLabel } from '@/lib/nav-labels';
import { resolveActiveNavEntry } from '@/lib/nav-active';
import type { ContextNav, RouteManifestEntry } from '@/config/route-manifest';
import type { NavCounts } from '@/hooks/use-nav-counts';
import { NavCountPill } from './nav-count-pill';
import { NavIcon } from './nav-icon';
import { useRailTooltip } from './rail-tooltip';

/** `sidebar`: the list of the sidebar (or its rail of icons). `sheet`: the tiles of the sheet "Altro" of the phone. */
type NavVariant = 'sidebar' | 'sheet';

interface GroupedNavLinksProps {
  nav: ContextNav;
  /** The entries of the menus and the pages that hang from them: the open page is looked for among them. */
  matchEntries: RouteManifestEntry[];
  variant?: NavVariant;
  /** Sidebar reduced to the icons (the names stay for screen readers and show as a tooltip on hover and on focus). */
  collapsed?: boolean;
  counts?: NavCounts;
  onNavigate?: () => void;
}

// The accent of the area: `--color-primary` is the accent while the redesign is on (UI-01), `-text` is the tone that
// reads on the soft background. Without the redesign both are the primary of the app.
const ACCENT_TEXT = 'text-[color:var(--color-primary-text,var(--color-primary))]';

const LINK_STYLES: Record<NavVariant, { row: string; active: string; inactive: string }> = {
  sidebar: {
    row: 'relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11',
    active: `bg-primary/10 font-semibold ${ACCENT_TEXT}`,
    inactive: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  },
  // Tiles, as the demo draws them: the icon above the name, a target far taller than the 44 px a finger needs. No border:
  // the page keeps its own border color (UI-01), a tile tells the open page by its background and a ring. The name comes
  // first in the markup and last on the screen (`flex-col-reverse`), so that a screen reader reads "Prenotazioni, 2
  // richieste da approvare" and not the counter before the name.
  sheet: {
    row: 'relative flex min-h-[4.5rem] flex-col-reverse justify-between gap-2 rounded-xl p-3 text-sm font-semibold leading-snug outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
    active: `bg-primary/10 ring-1 ring-inset ring-primary/40 ${ACCENT_TEXT}`,
    inactive: 'bg-muted/60 text-foreground hover:bg-muted',
  },
};

interface NavLinkItemProps {
  entry: RouteManifestEntry;
  active: boolean;
  collapsed: boolean;
  count: number;
  onNavigate?: () => void;
}

/** An entry of the sidebar: icon, name and counter; only the icon (and the name as a tooltip) when the sidebar is a rail. */
function NavLinkItem({ entry, active, collapsed, count, onNavigate }: NavLinkItemProps) {
  const { t } = useTranslation();
  const styles = LINK_STYLES.sidebar;
  const label = getNavLabel(entry, t);
  const { triggerProps, tooltip } = useRailTooltip(label, collapsed);

  return (
    <>
      <Link
        to={entry.path}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={cn(styles.row, active ? styles.active : styles.inactive, collapsed && 'justify-center px-0')}
        {...triggerProps}
      >
        {active ? <span aria-hidden="true" className="absolute -left-2 bottom-2 top-2 w-[3px] rounded-full bg-primary" /> : null}
        <NavIcon name={entry.icon} className="h-5 w-5 shrink-0" />
        <span className={cn('truncate', collapsed && 'sr-only')}>{label}</span>
        <NavCountPill
          entry={entry}
          count={count}
          className={collapsed ? 'absolute right-1 top-1 h-4 min-w-4 px-1 text-[10px]' : 'ml-auto'}
        />
      </Link>
      {tooltip}
    </>
  );
}

/** An entry of the sheet of the phone: a tile with the icon, the name and, on the corner, the counter. */
function NavTile({ entry, active, count, onNavigate }: Omit<NavLinkItemProps, 'collapsed'>) {
  const { t } = useTranslation();
  const styles = LINK_STYLES.sheet;

  return (
    <Link
      to={entry.path}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(styles.row, active ? styles.active : styles.inactive)}
    >
      {/* A wider font than the one tested (a Linux phone, a larger text size) breaks a long word instead of sticking out. */}
      <span className="min-w-0 break-words">{getNavLabel(entry, t)}</span>
      <span className="flex items-start justify-between">
        <NavIcon name={entry.icon} className={cn('h-[1.375rem] w-[1.375rem] shrink-0', ACCENT_TEXT)} />
        <NavCountPill entry={entry} count={count} className="-mr-1 -mt-1" />
      </span>
    </Link>
  );
}

const GROUP_LABEL_STYLES: Record<NavVariant, string> = {
  sidebar: 'px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground',
  sheet: 'px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground',
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
  const { triggerProps, tooltip } = useRailTooltip(label, collapsed);

  return (
    <div data-testid="nav-more">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setChoice({ pathname, open: !open })}
        className={cn(styles.row, styles.inactive, 'w-full', collapsed && 'justify-center px-0')}
        {...triggerProps}
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
      {tooltip}
      <ul id={listId} hidden={!open} className="mt-0.5 flex flex-col gap-0.5">
        {entries.map((entry) => (
          <li key={entry.path}>
            <NavLinkItem
              entry={entry}
              active={entry.path === activePath}
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
 * counters and, collapsed, only the icons with their names as tooltips (UI-04b); the sheet of the phone
 * (`variant="sheet"`) lists what the bottom bar does not, as tiles, and shows "Altro" as one more group.
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
  const isSheet = variant === 'sheet';
  const groupCount = nav.sections.length + (isSheet && nav.more.length > 0 ? 1 : 0);
  // A single group needs no name.
  const showGroupLabels = groupCount > 1 && !collapsed;

  const renderEntry = (entry: RouteManifestEntry) => {
    const entryCount = entry.navCount ? (counts[entry.navCount] ?? 0) : 0;
    return (
      <li key={entry.path}>
        {isSheet ? (
          <NavTile entry={entry} active={entry.path === activePath} count={entryCount} onNavigate={onNavigate} />
        ) : (
          <NavLinkItem
            entry={entry}
            active={entry.path === activePath}
            collapsed={collapsed}
            count={entryCount}
            onNavigate={onNavigate}
          />
        )}
      </li>
    );
  };

  const listClass = isSheet ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-0.5';

  return (
    <div className={cn('flex flex-col', isSheet ? 'gap-5' : 'gap-4')}>
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
            <ul className={listClass}>{section.entries.map(renderEntry)}</ul>
          </div>
        );
      })}
      {nav.more.length === 0 ? null : isSheet ? (
        <div
          role="group"
          aria-labelledby={showGroupLabels ? `${baseId}-more` : undefined}
          aria-label={showGroupLabels ? undefined : t('nav.more')}
          data-testid="nav-group-more"
        >
          {showGroupLabels ? (
            <p id={`${baseId}-more`} className={GROUP_LABEL_STYLES.sheet}>
              {t('nav.more')}
            </p>
          ) : null}
          <ul className={listClass}>{nav.more.map(renderEntry)}</ul>
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
