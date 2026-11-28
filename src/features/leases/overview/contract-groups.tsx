import { useTranslation } from 'react-i18next';
import { PlainSection, StatStrip, StatTile } from '@/components/shared/calm';
import { LONG_RENT_PROPERTIES_PATH } from '@/features/properties/long-rent/paths';
import { useWorkspace } from '@/hooks/use-workspace';
import type { LongRentLeaseCounters } from '@/types';
import { contractGroups } from './overview-model';

export function ContractGroups({ leases }: { leases: LongRentLeaseCounters }) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const action = hasPermission('long-rent', 'property.read')
    ? { actionLabel: t('longRentOverview.contracts.openProperties'), href: LONG_RENT_PROPERTIES_PATH }
    : {};

  return (
    <PlainSection className="min-w-0 rounded-xl border bg-card p-4 sm:p-5" title={t('longRentOverview.contracts.title')} {...action} data-testid="long-rent-contracts">
      <StatStrip label={t('longRentOverview.contracts.title')}>
        {contractGroups(leases).map((group) => (
          <StatTile key={group.chip} label={t(group.labelKey)} value={group.count} />
        ))}
      </StatStrip>
    </PlainSection>
  );
}
