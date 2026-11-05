import { useTranslation } from 'react-i18next';
import type { NavCountKey, RouteManifestEntry } from '@/config/route-manifest';
import { getNavCountLabel } from '@/lib/nav-labels';
import { cn } from '@/lib/utils';

interface NavCountPillProps {
  entry: RouteManifestEntry;
  count: number;
  /** Where the pill sits (next to the name, or on a corner of the icon): the place is the parent's. */
  className?: string;
}

/**
 * What a counter is about decides its color: a thing to answer is the accent of the area, a risk of a sanction and an urgent
 * thing to do are red. The words for a screen reader say the same, so the color is never the only signal.
 */
const PILL_COLOR: Record<NavCountKey, string> = {
  bookingRequests: 'bg-primary text-primary-foreground',
  supplierRequests: 'bg-primary text-primary-foreground',
  compliance: 'bg-destructive text-destructive-foreground',
  activities: 'bg-destructive text-destructive-foreground',
};

/**
 * The counter of a menu entry (`navCount`, UI-04a): the number on the screen (99+ above that) and, for a screen reader,
 * what it counts ("2 richieste da approvare"). Nothing while there is nothing to count. The sidebar, the bottom bar and
 * the sheet of the phone show the same pill, each in its own place.
 */
export function NavCountPill({ entry, count, className }: NavCountPillProps) {
  const { t } = useTranslation();
  if (!entry.navCount || count <= 0) return null;
  return (
    <span
      data-testid="nav-count"
      data-count-kind={entry.navCount}
      className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold leading-none', PILL_COLOR[entry.navCount], className)}
    >
      <span aria-hidden="true">{count > 99 ? '99+' : count}</span>
      <span className="sr-only">{`, ${getNavCountLabel(entry.navCount, count, t)}`}</span>
    </span>
  );
}
