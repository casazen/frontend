import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { getNavIcon } from '@/lib/nav-icons';
import { getNavGroupLabel, getNavLabel } from '@/lib/nav-labels';
import { isNavEntryActive } from '@/lib/nav-active';
import {
  NAV_GROUP_ORDER,
  type NavGroup,
  type RouteManifestEntry,
} from '@/config/route-manifest';

type NavVariant = 'sidebar' | 'drawer';

interface GroupedNavLinksProps {
  grouped: Map<NavGroup, RouteManifestEntry[]>;
  allEntries: RouteManifestEntry[];
  variant?: NavVariant;
  onNavigate?: () => void;
}

const linkStyles: Record<NavVariant, { active: string; inactive: string; row: string }> = {
  sidebar: {
    row: 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    active: 'bg-primary text-primary-foreground shadow-sm',
    inactive: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  },
  drawer: {
    row: 'flex min-h-11 items-center gap-3 px-4 py-3 text-sm font-medium transition-colors',
    active: 'bg-primary/10 text-primary',
    inactive: 'text-foreground hover:bg-accent',
  },
};

export function GroupedNavLinks({
  grouped,
  allEntries,
  variant = 'sidebar',
  onNavigate,
}: GroupedNavLinksProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const styles = linkStyles[variant];
  const visibleGroups = NAV_GROUP_ORDER.filter((group) => grouped.has(group));

  return (
    <>
      {visibleGroups.map((group) => {
        const entries = grouped.get(group) ?? [];
        return (
          <div key={group} className={variant === 'sidebar' ? 'mb-4' : 'mb-4'}>
            <p
              className={cn(
                'text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                variant === 'sidebar' ? 'px-3 py-2' : 'px-4 py-2',
              )}
            >
              {getNavGroupLabel(group, t)}
            </p>
            {entries.map((entry) => {
              const Icon = getNavIcon(entry.icon);
              const active = isNavEntryActive(location.pathname, entry, allEntries);
              return (
                <Link
                  key={entry.path}
                  to={entry.path}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(styles.row, active ? styles.active : styles.inactive)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {getNavLabel(entry, t)}
                </Link>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
