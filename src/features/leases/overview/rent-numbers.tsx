import { useTranslation } from 'react-i18next';
import { PlainSection, StatStrip, StatTile } from '@/components/shared/calm';
import { formatCurrency } from '@/lib/utils';
import type { RentRegisterCounters } from '@/types';
import { isRentMonth, monthName, rentRegisterPath } from '../lib/rent-register';

export function RentNumbers({ rents, rentMonth, currentMonth }: { rents: RentRegisterCounters; rentMonth: string; currentMonth: string }) {
  const { t, i18n } = useTranslation();
  const month = isRentMonth(rentMonth) ? rentMonth : currentMonth;
  const name = monthName(month, i18n.language, false);
  const late = rents.overdue.count > 0;
  const euros = (amount: number) => formatCurrency(amount);

  return (
    <PlainSection className="min-w-0 rounded-xl border bg-card p-4 sm:p-5"
      title={t('longRentOverview.rents.title', { month: name })}
      actionLabel={t('longRentOverview.rents.all')}
      href={rentRegisterPath(month, currentMonth)}
      data-testid="long-rent-rents"
    >
      <StatStrip label={t('longRentOverview.rents.label')}>
        <StatTile
          label={t('longRentOverview.rents.collected', { month: name })}
          value={euros(rents.collected.amount)}
          delta={t('longRentOverview.rents.collectedDelta', {
            count: rents.expected.count,
            paid: rents.collected.count,
            expected: euros(rents.expected.amount),
          })}
          href={rentRegisterPath(month, currentMonth, 'paid')}
        />
        <StatTile
          label={t('longRentOverview.rents.overdue')}
          value={euros(rents.overdue.amount)}
          tone={late ? 'danger' : 'neutral'}
          delta={late ? t('longRentOverview.rents.overdueDelta', { count: rents.overdue.count }) : t('longRentOverview.rents.noOverdue')}
          href={rentRegisterPath(month, currentMonth, 'overdue')}
        />
        <StatTile
          label={t('longRentOverview.rents.pending')}
          value={euros(rents.pending.amount)}
          delta={
            rents.pending.count > 0
              ? t('longRentOverview.rents.pendingDelta', { count: rents.pending.count })
              : t('longRentOverview.rents.nothingPending')
          }
          href={rentRegisterPath(month, currentMonth, 'pending')}
        />
      </StatStrip>
    </PlainSection>
  );
}
