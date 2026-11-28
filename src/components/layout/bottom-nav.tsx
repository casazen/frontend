import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Ellipsis } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNavBarLabel, getNavCountLabel, getNavLabel } from '@/lib/nav-labels';
import { useMobileNav } from '@/hooks/use-mobile-nav';
import { useNavCounts } from '@/hooks/use-nav-counts';
import { useUiStore } from '@/store/ui-store';
import type { AppContextKey, NavCountKey } from '@/config/route-manifest';
import { NavCountPill } from './nav-count-pill';
import { NavIcon } from './nav-icon';

interface BottomNavProps {
  contextKey: AppContextKey;
}

const COMPLIANCE_COUNT: NavCountKey = 'compliance';

const ITEM_CLASS =
  'relative flex min-h-11 min-w-0 flex-1 flex-col-reverse items-center justify-center gap-0.5 px-0 text-[11px] font-semibold leading-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring max-[340px]:text-[10px]';
const ITEM_ACTIVE = 'text-[color:var(--color-primary-text,var(--color-primary))]';
const ITEM_INACTIVE = 'text-muted-foreground';

function ActiveLine() {
  return <span aria-hidden="true" className="absolute inset-x-1/4 top-0 h-[3px] rounded-b-full bg-primary" />;
}

function BarIcon({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'relative flex h-[1.875rem] w-[3.25rem] items-center justify-center rounded-full transition-colors motion-reduce:transition-none',
        active && 'bg-primary/10',
      )}
    >
      {children}
    </span>
  );
}

/**
 * The bottom bar of the phone (UI-04b): the four destinations of the area (`navBottom` in the manifest) and "Altro", which
 * opens the sheet with the rest (`MoreSheet`) and the area switcher. The tab of the open page is marked with
 * `aria-current` and the accent; the counters of the destinations sit on their icons. Every tab is at least 44 px wide
 * and as tall as the bar (64 px, plus the home indicator of the phone below it).
 *
 * While the bar is on the page it says so (`bottomBarVisible` of the UI store), and the toasts come up above it
 * (`AppToaster`). It is the bar of the phone: from `md` the sidebar takes its place.
 */
export function BottomNav({ contextKey }: BottomNavProps) {
  const { t } = useTranslation();
  const { bottomEntries, moreEntries, hasMore, hasBar, activeTab, sidebarOpen, setSidebarOpen } = useMobileNav(contextKey);
  const setBottomBarVisible = useUiStore((state) => state.setBottomBarVisible);
  const counts = useNavCounts([...bottomEntries, ...moreEntries]);
  const moreFines = moreEntries.some((entry) => entry.navCount === COMPLIANCE_COUNT) ? (counts[COMPLIANCE_COUNT] ?? 0) : 0;

  useEffect(() => {
    if (!hasBar) return undefined;
    setBottomBarVisible(true);
    return () => setBottomBarVisible(false);
  }, [hasBar, setBottomBarVisible]);

  if (!hasBar) {
    return null;
  }

  const moreIsActive = activeTab === 'more';

  return (
    <nav
      aria-label={t('shell.mobileNavigation')}
      className="workspace-mobile-nav fixed bottom-0 inset-x-0 z-50 border-t bg-card md:hidden"
      style={{ height: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex h-full items-stretch pb-[env(safe-area-inset-bottom)]">
        {bottomEntries.map((entry) => {
          const isActive = activeTab === entry.path;
          const shortName = getNavBarLabel(entry, t);
          return (
            <Link
              key={entry.path}
              to={entry.path}
              aria-label={shortName ? getNavLabel(entry, t) : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={cn(ITEM_CLASS, isActive ? ITEM_ACTIVE : ITEM_INACTIVE)}
            >
              {isActive ? <ActiveLine /> : null}
              <span className="max-w-full truncate">{shortName ?? getNavLabel(entry, t)}</span>
              <BarIcon active={isActive}>
                <NavIcon name={entry.icon} className="h-6 w-6 shrink-0" />
                <NavCountPill
                  entry={entry}
                  count={entry.navCount ? (counts[entry.navCount] ?? 0) : 0}
                  className="absolute -right-0.5 -top-1 h-[1.125rem] min-w-[1.125rem] px-1 text-[10px] ring-2 ring-background"
                />
              </BarIcon>
            </Link>
          );
        })}
        {hasMore ? (
          <button
            type="button"
            data-more-trigger=""
            aria-haspopup="dialog"
            aria-expanded={sidebarOpen}
            aria-current={moreIsActive ? 'page' : undefined}
            onClick={() => setSidebarOpen(true)}
            className={cn(ITEM_CLASS, moreIsActive ? ITEM_ACTIVE : ITEM_INACTIVE)}
          >
            {moreIsActive ? <ActiveLine /> : null}
            <span>{t('nav.more')}</span>
            <BarIcon active={moreIsActive}>
              <Ellipsis className="h-6 w-6 shrink-0" aria-hidden="true" />
              {moreFines > 0 ? (
                <>
                  <span
                    aria-hidden="true"
                    data-testid="more-compliance-mark"
                    className="absolute right-2 top-0.5 size-2.5 rounded-full bg-destructive ring-2 ring-background"
                  />
                  <span className="sr-only">{`, ${getNavCountLabel(COMPLIANCE_COUNT, moreFines, t)}`}</span>
                </>
              ) : null}
            </BarIcon>
          </button>
        ) : null}
      </div>
    </nav>
  );
}
