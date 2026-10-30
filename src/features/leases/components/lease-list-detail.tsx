import { useMemo, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActivityList, PlainSection } from '@/components/shared/calm';
import { StatusExplainer } from '@/components/shared/status/status-explainer';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getLeaseEventTypeLabel } from '@/lib/i18n-labels';
import { useLease } from '@/queries/use-leases';
import type { LeaseSummary } from '@/types';
import {
  leaseNextRentText,
  leaseOverdueText,
  leasePropertyLine,
  leaseRentText,
  leaseTenantName,
  leaseTermText,
} from '../lib/lease-list-format';

/** The last events of the lease, the most recent first; "Mostra altri" shows the rest. */
const EVENTS_SHOWN = 5;

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="shrink-0 text-foreground/70 sm:w-28">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{children}</dd>
    </div>
  );
}

/**
 * The inside of the drawer of a lease in the list (LR-02): the state told in words (what it means and what it takes to move on,
 * from the dictionary of states), the lease at a glance and its latest events. The summary is the row of the list, so it is
 * there at once; only the history asks the API (`GET /leases/{id}`). The way to the whole lease is the foot of the drawer.
 */
export function LeaseListDetail({ lease }: { lease: LeaseSummary }) {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError, refetch, isFetching } = useLease(lease.id);

  const events = useMemo(
    () =>
      (data?.events ?? []).map((event, index) => ({
        id: `${event.eventType}-${event.occurredAt}-${index}`,
        at: event.occurredAt,
        text: getLeaseEventTypeLabel(event.eventType, t),
      })),
    [data, t],
  );

  const overdue = leaseOverdueText(lease, t);
  const next = overdue ? null : leaseNextRentText(lease, t, i18n.language);

  return (
    <div className="min-w-0 space-y-6" data-testid="lease-list-detail">
      {lease.stage ? (
        <StatusExplainer kind="leaseStage" status={lease.stage} compact />
      ) : (
        <StatusExplainer kind="lease" status={lease.status} compact />
      )}

      <dl className="space-y-3 text-sm">
        <Fact label={t('leaseList.detail.tenant')}>{leaseTenantName(lease, t)}</Fact>
        <Fact label={t('leaseList.detail.property')}>{leasePropertyLine(lease, t)}</Fact>
        <Fact label={t('leaseList.columns.term')}>{leaseTermText(lease, t, i18n.language)}</Fact>
        <Fact label={t('leaseList.columns.rent')}>
          {leaseRentText(lease, t)}
          {overdue ? (
            <span className="mt-0.5 flex items-start gap-1.5 text-danger-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{overdue}</span>
            </span>
          ) : null}
          {next ? <span className="mt-0.5 block font-normal text-foreground/70">{next}</span> : null}
        </Fact>
        <Fact label={t('leaseList.columns.parties')}>{lease.partyCount}</Fact>
      </dl>

      <PlainSection title={t('leaseList.detail.events')}>
        {isLoading ? (
          <SkeletonLine lines={3} label={t('leaseList.detail.eventsLoading')} />
        ) : isError ? (
          <div role="alert" className="space-y-2 text-sm">
            <p>{t('leaseList.detail.eventsError')}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
              {t('leases.retry')}
            </Button>
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-foreground/70">{t('leaseList.detail.eventsEmpty')}</p>
        ) : (
          <ActivityList key={lease.id} items={events} more={{ limit: EVENTS_SHOWN, label: t('leaseList.detail.eventsMore') }} />
        )}
      </PlainSection>
    </div>
  );
}
