import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityList, PlainSection } from '@/components/shared/calm';
import { getLeaseEventTypeLabel } from '@/lib/i18n-labels';
import type { LeaseEvent } from '@/types';
import { leaseEventActor } from '../lib/lease-sheet';

/** The latest events of the lease; "Mostra tutta la cronologia" shows the rest. */
const EVENTS_SHOWN = 5;

/**
 * The history of the lease (column on the right of the sheet, a section under the tabs on a narrow page): what happened, when
 * and, where the type of the event settles it, who did it. The events are those the API already sends (their type and date; the
 * payloads never leave the server), put in order by `ActivityList`, the latest first.
 */
export function LeaseHistory({ leaseId, events }: { leaseId: string; events: readonly LeaseEvent[] }) {
  const { t } = useTranslation();

  const items = useMemo(
    () =>
      events.map((event, index) => {
        const actor = leaseEventActor(event.eventType);
        return {
          id: `${event.eventType}-${event.occurredAt}-${index}`,
          at: event.occurredAt,
          text: getLeaseEventTypeLabel(event.eventType, t),
          actor: actor ? t(`leaseSheet.history.actor.${actor}`) : undefined,
        };
      }),
    [events, t],
  );

  return (
    <PlainSection title={t('leases.timeline')} data-testid="lease-timeline">
      {items.length === 0 ? (
        <p className="text-sm text-foreground/70">{t('leaseList.detail.eventsEmpty')}</p>
      ) : (
        <ActivityList key={leaseId} items={items} more={{ limit: EVENTS_SHOWN, label: t('leaseSheet.history.more') }} />
      )}
    </PlainSection>
  );
}
