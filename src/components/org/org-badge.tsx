import { Link } from 'react-router-dom';
import { useCurrentUser } from '@/queries/use-users';
import { PlanBadge } from './plan-badge';
import { PLAN_UPGRADE_PATH } from '@/lib/entitlement-error';

/**
 * Org + plan indicator for the app header (#202, AC11).
 * Links to plan settings so operators can review or change tier.
 */
export function OrgBadge() {
  const { org, isLoading } = useCurrentUser();

  if (isLoading || !org) return null;

  return (
    <Link
      to={PLAN_UPGRADE_PATH}
      className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-muted/60"
      data-testid="org-badge"
      title="Gestisci piano"
    >
      <span className="hidden max-w-[12rem] truncate text-sm font-medium text-foreground sm:inline">
        {org.name}
      </span>
      <PlanBadge planTier={org.planTier} />
    </Link>
  );
}
