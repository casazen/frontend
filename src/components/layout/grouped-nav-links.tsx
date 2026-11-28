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
import { useAppShell } from './app-shell-context';
import { DEFAULT_WORKSPACE_VIEW, useUiStore } from '@/store/ui-store';
import { useRailTooltip } from './rail-tooltip';

type NavVariant = 'sidebar' | 'sheet';

interface GroupedNavLinksProps {
  nav: ContextNav;
  matchEntries: RouteManifestEntry[];
  variant?: NavVariant;
  collapsed?: boolean;
  counts?: NavCounts;
  onNavigate?: () => void;
}

const ACCENT_TEXT = 'text-[color:var(--color-primary-text,var(--color-primary))]';

const LINK_STYLES: Record<NavVariant, { row: string; active: string; inactive: string }> = {
  sidebar: {
    row: 'relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11',
    active: `bg-primary/10 font-semibold ${ACCENT_TEXT}`,
    inactive: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  },
  sheet: {
    row: 'relative flex h-full min-h-12 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold leading-snug outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
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
        <span className={cn('min-w-0 break-words py-1 leading-snug', collapsed && 'sr-only')}>{label}</span>
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
      <NavIcon name={entry.icon} className={cn('size-5 shrink-0', ACCENT_TEXT)} />
      <span className="min-w-0 flex-1 break-words">{getNavLabel(entry, t)}</span>
      <NavCountPill entry={entry} count={count} />
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
  const counted = open ? [] : entries.filter((entry) => entry.navCount && (counts[entry.navCount] ?? 0) > 0);
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
        <span className={cn('min-w-0 break-words py-1 leading-snug', collapsed && 'sr-only')}>{label}</span>
        {counted.map((entry) => (
          <NavCountPill
            key={entry.path}
            entry={entry}
            count={entry.navCount ? (counts[entry.navCount] ?? 0) : 0}
            className={collapsed ? 'absolute right-1 top-1 h-4 min-w-4 px-1 text-[10px]' : 'ml-auto'}
          />
        ))}
        {collapsed ? null : (
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none',
              counted.length === 0 && 'ml-auto',
              open && 'rotate-180',
            )}
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

interface FooterNavLinksProps {
  entries: RouteManifestEntry[];
  matchEntries: RouteManifestEntry[];
  collapsed?: boolean;
  counts?: NavCounts;
  onNavigate?: () => void;
}

export function FooterNavLinks({ entries, matchEntries, collapsed = false, counts = {}, onNavigate }: FooterNavLinksProps) {
  const { pathname } = useLocation();
  if (entries.length === 0) return null;
  const activePath = resolveActiveNavEntry(pathname, matchEntries)?.path;

  return (
    <ul className="flex flex-col gap-0.5" data-testid="nav-footer">
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
  );
}

export function GroupedNavLinks({
  nav: originalNav,
  matchEntries,
  variant = 'sidebar',
  collapsed = false,
  counts = {},
  onNavigate,
}: GroupedNavLinksProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const baseId = useId();
  const key = useAppShell()?.viewKey;
  const view = useUiStore(state => (key && state.workspaceViews[key]) || DEFAULT_WORKSPACE_VIEW);
  const moved = originalNav.sections.flatMap(section => section.entries.filter(entry => view.secondaryPaths.includes(entry.path)));
  const nav = moved.length ? {
    ...originalNav,
    sections: originalNav.sections.map(section => ({ ...section, entries: section.entries.filter(entry => !view.secondaryPaths.includes(entry.path)) })).filter(section => section.entries.length),
  } : originalNav;
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const activePath = resolveActiveNavEntry(pathname, matchEntries)?.path;
  const isSheet = variant === 'sheet';
  const groupCount =
    nav.sections.length + (isSheet && nav.more.length > 0 ? 1 : 0) + (isSheet && nav.footer.length > 0 ? 1 : 0);
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

  const listClass = isSheet ? 'grid grid-cols-1 gap-1.5 min-[23rem]:grid-cols-2' : 'flex flex-col gap-0.5';

  return (
    <div className={cn('flex flex-col', isSheet ? 'gap-5' : 'gap-4')}>
      {nav.sections.map((section, index) => {
        const label = getNavGroupLabel(section.group, t);
        const labelId = `${baseId}-${section.group}`;
        const listId = `${labelId}-entries`;
        const foldKey = `${pathname}:${section.group}`;
        const foldable = showGroupLabels && !isSheet;
        const expanded = !foldable || !folded[foldKey];
        return (
          <div
            key={section.group}
            role="group"
            aria-labelledby={showGroupLabels ? labelId : undefined}
            aria-label={showGroupLabels ? undefined : label}
            data-testid={`nav-group-${section.group}`}
            className={cn(collapsed && index > 0 && 'border-t pt-2')}
          >
            {foldable ? (
              <button
                type="button"
                id={labelId}
                aria-controls={listId}
                aria-expanded={expanded}
                onClick={() => setFolded(previous => ({ ...previous, [foldKey]: expanded }))}
                className="workspace-group-toggle"
              >
                {label}
                <ChevronDown aria-hidden="true" className={cn('size-3.5', !expanded && '-rotate-90')} />
              </button>
            ) : showGroupLabels ? (
              <p id={labelId} className={GROUP_LABEL_STYLES[variant]}>
                {label}
              </p>
            ) : null}
            <ul id={listId} hidden={!expanded} className={expanded ? listClass : undefined}>{section.entries.map(renderEntry)}</ul>
          </div>
        );
      })}
      {moved.length > 0 && (
        <details key={activePath} open={moved.some(entry => entry.path === activePath)} className="min-w-0">
          <summary className="min-h-11 cursor-pointer content-center rounded-lg px-2 text-sm font-medium focus-visible:outline-ring" aria-label={t('workspaceView.other')}>
            <span className={collapsed ? 'sr-only' : undefined}>{t('workspaceView.other')}</span>
          </summary>
          <ul className={listClass}>{moved.map(renderEntry)}</ul>
        </details>
      )}
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
      {isSheet && nav.footer.length > 0 ? (
        <div
          role="group"
          aria-labelledby={showGroupLabels ? `${baseId}-footer` : undefined}
          aria-label={showGroupLabels ? undefined : t('nav.group.footer')}
          data-testid="nav-group-footer"
        >
          {showGroupLabels ? (
            <p id={`${baseId}-footer`} className={GROUP_LABEL_STYLES.sheet}>
              {t('nav.group.footer')}
            </p>
          ) : null}
          <ul className={listClass}>{nav.footer.map(renderEntry)}</ul>
        </div>
      ) : null}
    </div>
  );
}
