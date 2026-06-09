import { useCurrentUser } from '@/queries/use-users';
import { PlanBadge } from './plan-badge';

/**
 * Org + plan indicator for the app header (#202, AC11).
 * Renders nothing while loading or when the caller has no org (pre-backfill), so the
 * header degrades gracefully instead of breaking for tenant-less users.
 */
export function OrgBadge() {
  const { org, isLoading } = useCurrentUser();

  if (isLoading || !org) return null;

  return (
    <div className="flex items-center gap-2" data-testid="org-badge">
      <span className="hidden max-w-[12rem] truncate text-sm font-medium text-foreground sm:inline">
        {org.name}
      </span>
      <PlanBadge planTier={org.planTier} />
    </div>
  );
}
