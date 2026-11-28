import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityList } from '@/components/shared/calm';
import { getLeaseEventTypeLabel } from '@/lib/i18n-labels';
import type { LeaseEvent } from '@/types';
import { leaseEventActor } from '../lib/lease-sheet';

const EVENTS_SHOWN = 5;

export function LeaseHistory({ leaseId, events, initiallyOpen }: { leaseId: string; events: readonly LeaseEvent[]; initiallyOpen: boolean }) {
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
    <details open={initiallyOpen} data-testid="lease-timeline" className="rounded-xl border bg-card px-4">
      <summary className="cursor-pointer rounded-sm py-3 font-semibold focus-visible:outline-ring">{t('leases.timeline')}</summary>
      <div className="pb-4">
        {items.length === 0 ? (
          <p className="text-sm text-foreground/70">{t('leaseList.detail.eventsEmpty')}</p>
        ) : (
          <ActivityList key={leaseId} items={items} more={{ limit: EVENTS_SHOWN, label: t('leaseSheet.history.more') }} />
        )}
      </div>
    </details>
  );
}
