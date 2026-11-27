import { useTranslation } from 'react-i18next';
import { getArea } from '@/config/areas';
import type { AppContextKey } from '@/config/route-manifest';
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
export function OrgBadge({ area }: { area?: AppContextKey }) {
  const { t } = useTranslation();
  const { org, isLoading } = useCurrentUser();
  const planPath = usePlanPagePath();

  const areaLabel = area ? (
    <span data-testid="header-area" className="block truncate text-sm font-semibold leading-tight text-foreground">
      {t(getArea(area).nameKey)}
    </span>
  ) : null;
  const badgeClass = area ? 'flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-md px-1' : BADGE_CLASS;

  if (isLoading || !org) return areaLabel ? <div className={badgeClass}>{areaLabel}</div> : null;

  const content = area ? (
    <>
      {areaLabel}
      <span className="block truncate text-xs text-muted-foreground" title={org.name}>{org.name}</span>
    </>
  ) : (
    <>
      <span className="hidden max-w-[12rem] truncate text-sm font-medium text-foreground sm:inline">
        {org.name}
      </span>
      <PlanBadge planTier={org.planTier} />
    </>
  );

  if (!planPath) {
    return (
      <div className={badgeClass} data-testid="org-badge">
        {content}
      </div>
    );
  }

  return (
    <Link
      to={planPath}
      className={`${badgeClass} transition-colors hover:bg-muted/60`}
      data-testid="org-badge"
      title={t('plan.managePlan')}
      aria-label={area ? [t(getArea(area).nameKey), org.name, t('plan.managePlan')].join(' · ') : undefined}
    >
      {content}
    </Link>
  );
}
