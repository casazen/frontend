import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import type { LongRentLeaseCounters } from '@/types';
import { contractGroups } from './overview-model';

const LEASES_PATH = '/app/long-rent/leases';

const GROUP_LINK =
  'inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium outline-hidden ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

/**
 * «I tuoi contratti»: how many leases are in each of the four groups the list of leases has as quick filters, and each group is a
 * link to the list already narrowed to it (`?chip=`). The numbers are the server's.
 */
export function ContractGroups({ leases }: { leases: LongRentLeaseCounters }) {
  const { t } = useTranslation();

  return (
    <PlainSection
      title={t('longRentOverview.contracts.title')}
      actionLabel={t('longRentOverview.contracts.all')}
      href={LEASES_PATH}
      data-testid="long-rent-contracts"
    >
      <ul role="list" className="flex flex-wrap gap-2">
        {contractGroups(leases).map((group) => (
          <li key={group.chip} className="min-w-0 max-w-full">
            <Link to={`${LEASES_PATH}?chip=${group.chip}`} data-testid={`long-rent-contracts-${group.chip}`} className={GROUP_LINK}>
              <span className="min-w-0 break-words">{t(group.labelKey)}</span>
              <span className="font-semibold tabular-nums">{group.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </PlainSection>
  );
}
