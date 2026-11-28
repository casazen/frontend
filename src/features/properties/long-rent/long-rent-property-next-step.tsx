import { useTranslation } from 'react-i18next';
import { FocusBlock } from '@/components/shared/calm';
import { leaseSheetPath } from '@/features/leases/lib/lease-next-step';
import { formatCurrency } from '@/lib/utils';
import { leaseOfRow, tenantOfRow } from './long-rent-property-format';
import type { LongRentPropertyRow } from './long-rent-property-rows';
import { longRentLeasePath, newLeaseForPropertyPath } from './paths';

interface LongRentPropertyNextStepProps {
  row: LongRentPropertyRow;
  canCreateLease: boolean;
}

export function LongRentPropertyNextStep({ row, canCreateLease }: LongRentPropertyNextStepProps) {
  const { t, i18n } = useTranslation();
  const lease = leaseOfRow(row);
  const tenant = tenantOfRow(row, t, i18n.language);

  if (lease && tenant) {
    const open = { label: t('longRentProperties.list.actions.openLease'), href: longRentLeasePath(lease.id), testId: 'long-rent-property-lease' };

    if (row.current) {
      return (
        <FocusBlock
          data-testid="long-rent-property-next-step"
          data-next-step="rented"
          kicker={t('longRentProperties.detail.next.rented.kicker')}
          title={tenant.name}
          body={`${formatCurrency(row.current.monthlyRent)} ${t('longRentProperties.list.perMonth')}`}
          when={tenant.note ?? undefined}
          primary={open}
          secondary={{ label: t('longRentProperties.detail.openRentSchedule'), href: leaseSheetPath(lease.id, 'pagamenti') }}
        />
      );
    }

    return (
      <FocusBlock
        data-testid="long-rent-property-next-step"
        data-next-step="preparing"
        kicker={t('longRentProperties.detail.next.preparing.kicker')}
        title={tenant.name}
        body={tenant.note ?? undefined}
        primary={open}
      />
    );
  }

  if (row.status === 'Free' && canCreateLease) {
    return (
      <FocusBlock
        data-testid="long-rent-property-next-step"
        data-next-step="free"
        kicker={t('longRentProperties.detail.next.free.kicker')}
        title={t('longRentProperties.detail.next.free.title')}
        body={t('longRentProperties.detail.next.free.body')}
        primary={{
          label: t('longRentProperties.list.actions.createLease'),
          href: newLeaseForPropertyPath(row.property.id),
          testId: 'long-rent-property-new-lease',
        }}
      />
    );
  }

  return null;
}
