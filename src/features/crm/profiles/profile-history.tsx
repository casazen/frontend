import { CalendarX2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { DataView, type DataColumn } from '@/components/ui/data-view';
import { formatDay, formatMoney } from '@/features/crm/lib/crm-format';
import { channelLabel } from '@/features/crm/lib/crm-labels';
import type { CrmProfileStay } from '@/types/crm.types';

interface ProfileHistoryProps {
  stays: CrmProfileStay[];
  /** There are more bookings than `stays` holds: the totals count them all. */
  truncated: boolean;
}

/**
 * The history of a profile (E07/F01/US04/T02): each booking with its property, its dates, its channel, its status and its amount, the
 * latest arrival first. A table where there is room and a list of cards on a phone. The bookings are the ones the caller reaches.
 */
export function ProfileHistory({ stays, truncated }: ProfileHistoryProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  const dates = (stay: CrmProfileStay) =>
    t('crm.detail.history.range', { from: formatDay(stay.checkInDate, language) ?? '', to: formatDay(stay.checkOutDate, language) ?? '' });
  const nights = (stay: CrmProfileStay) => t('crm.detail.history.nights', { count: stay.nights });
  const channel = (stay: CrmProfileStay) => channelLabel(t, stay.channel, stay.channelLabel);

  const columns: DataColumn<CrmProfileStay>[] = [
    {
      key: 'property',
      header: t('crm.detail.history.columns.property'),
      rowHeader: true,
      cell: (stay) => (
        <span className="block min-w-0 break-words">
          {stay.propertyName}
          <span className="block text-sm font-normal text-foreground/70">{nights(stay)}</span>
        </span>
      ),
    },
    { key: 'dates', header: t('crm.detail.history.columns.dates'), cell: dates },
    { key: 'channel', header: t('crm.detail.history.columns.channel'), cell: channel },
    { key: 'status', header: t('crm.detail.history.columns.status'), cell: (stay) => <StatusBadge kind="booking" status={stay.status} /> },
    { key: 'total', header: t('crm.detail.history.columns.total'), align: 'end', cell: (stay) => formatMoney(stay.total, language) },
  ];

  return (
    <PlainSection title={t('crm.detail.history.title')} count={stays.length} data-testid="crm-history">
      <DataView
        label={t('crm.detail.history.title')}
        rows={stays}
        columns={columns}
        rowKey={(stay) => stay.bookingId}
        cardsUntil="lg"
        testId="crm-history-list"
        empty={{
          icon: CalendarX2,
          title: t('crm.detail.history.empty.title'),
          description: t('crm.detail.history.empty.description'),
        }}
        renderCard={(stay) => (
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 break-words font-medium">{stay.propertyName}</p>
              <StatusBadge kind="booking" status={stay.status} />
            </div>
            <p className="text-sm text-foreground/70">
              {dates(stay)} · {nights(stay)}
            </p>
            <p className="text-sm text-foreground/70">
              {channel(stay)} · {formatMoney(stay.total, language)}
            </p>
          </div>
        )}
        footer={
          truncated ? (
            <p className="text-sm text-foreground/70" data-testid="crm-history-truncated">
              {t('crm.detail.history.truncated', { count: stays.length })}
            </p>
          ) : undefined
        }
      />
    </PlainSection>
  );
}
