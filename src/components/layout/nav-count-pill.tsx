import { useTranslation } from 'react-i18next';
import type { NavCountKey, RouteManifestEntry } from '@/config/route-manifest';
import { getNavCountLabel } from '@/lib/nav-labels';
import { cn } from '@/lib/utils';

interface NavCountPillProps {
  entry: RouteManifestEntry;
  count: number;
  className?: string;
}

const PILL_COLOR: Record<NavCountKey, string> = {
  bookingRequests: 'bg-primary text-primary-foreground',
  supplierRequests: 'bg-primary text-primary-foreground',
  compliance: 'bg-destructive text-destructive-foreground',
  activities: 'bg-destructive text-destructive-foreground',
  messages: 'bg-primary text-primary-foreground',
};

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
