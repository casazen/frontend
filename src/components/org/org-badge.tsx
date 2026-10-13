import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '@/queries/use-users';
import { usePlanPagePath } from '@/hooks/use-billing-context';
import { PlanBadge } from './plan-badge';

const BADGE_CLASS = 'flex items-center gap-2 rounded-md px-2 py-1';

/**
 * Org + plan indicator for the app header (#202, AC11). Links to the plan page of the current shell (short-rent or
 * long-rent, PL-16); from the admin or supplier shell to the plan page of the user's rental context, and to nothing when
 * the user has none.
 */
export function OrgBadge() {
  const { t } = useTranslation();
  const { org, isLoading } = useCurrentUser();
  const planPath = usePlanPagePath();

  if (isLoading || !org) return null;

  const content = (
    <>
      <span className="hidden max-w-[12rem] truncate text-sm font-medium text-foreground sm:inline">
        {org.name}
      </span>
      <PlanBadge planTier={org.planTier} />
    </>
  );

  if (!planPath) {
    return (
      <div className={BADGE_CLASS} data-testid="org-badge">
        {content}
      </div>
    );
  }

  return (
    <Link
      to={planPath}
      className={`${BADGE_CLASS} transition-colors hover:bg-muted/60`}
      data-testid="org-badge"
      title={t('plan.managePlan')}
    >
      {content}
    </Link>
  );
}
