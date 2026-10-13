import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { getProblemMessage } from '@/lib/api-errors';
import { useDecideFreeEvent } from '@/queries/use-supplier';
import type { FreeEventDecision, PendingFreeEvent } from '@/types/supplier';
import { describeFreeEventWhen } from '../lib/free-events';

interface FreeEventsBannerProps {
  items: readonly PendingFreeEvent[];
  pendingCount: number;
  /** A sync is running (it was queued by an "Available" answer): the days are about to be refreshed. */
  syncing?: boolean;
}

/**
 * Calendar events marked "Disponibile" that block their days until the supplier answers. Full width, above the days.
 * Titles are personal data: they are shown here, to the owner, and nowhere else.
 */
export function FreeEventsBanner({ items, pendingCount, syncing = false }: FreeEventsBannerProps) {
  const { t } = useTranslation();
  const decide = useDecideFreeEvent();
  const [confirming, setConfirming] = useState<PendingFreeEvent | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const send = async (event: PendingFreeEvent, decision: FreeEventDecision) => {
    setBusyId(event.id);
    try {
      await decide.mutateAsync({ id: event.id, decision });
      toast.success(t(decision === 'Available' ? 'supplier.freeEventsAvailableDone' : 'supplier.freeEventsBusyDone'));
    } catch (error) {
      toast.error(getProblemMessage(error, t) ?? t('supplier.freeEventsDecisionError'));
    } finally {
      setBusyId(null);
      setConfirming(null);
    }
  };

  const titleOf = (event: PendingFreeEvent) => event.summary.trim() || t('supplier.freeEventsUntitled');

  return (
    <section aria-labelledby="free-events-title" className="w-full" data-testid="free-events-banner">
      <Alert variant="warning" className="w-full">
        <div className="space-y-3">
          <div>
            <h2 id="free-events-title" className="font-semibold">
              {t('supplier.freeEventsBannerTitle', { count: pendingCount })}
            </h2>
            <p className="text-sm">{t('supplier.freeEventsBannerHint')}</p>
            {syncing ? (
              <p className="mt-1 flex items-center gap-1 text-sm" data-testid="free-events-syncing">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                {t('supplier.freeEventsSyncing')}
              </p>
            ) : null}
          </div>

          <ul className="w-full space-y-2" aria-label={t('supplier.freeEventsListLabel')}>
            {items.map((event) => {
              const title = titleOf(event);
              const busy = busyId === event.id;
              return (
                <li
                  key={event.id}
                  className="flex w-full flex-col gap-2 rounded-md bg-background/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                  data-testid={`free-event-${event.id}`}
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground">
                      {describeFreeEventWhen(event, i18n.language)}
                      {' · '}
                      {event.isAllDay ? t('supplier.freeEventsAllDay') : null}
                      {event.recurring ? `${event.isAllDay ? ' · ' : ''}${t('supplier.freeEventsRecurring', { count: event.occurrences })}` : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={busy || decide.isPending}
                      aria-label={t('supplier.freeEventsAvailableAria', { title })}
                      onClick={() => setConfirming(event)}
                    >
                      {t('supplier.freeEventsAvailableCta')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || decide.isPending}
                      aria-label={t('supplier.freeEventsBusyAria', { title })}
                      onClick={() => void send(event, 'Busy')}
                    >
                      {busy && decide.variables?.decision === 'Busy' ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />
                      ) : null}
                      {t('supplier.freeEventsBusyCta')}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </Alert>

      <ConfirmationDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open && !decide.isPending) setConfirming(null);
        }}
        title={t('supplier.freeEventsConfirmTitle')}
        description={t('supplier.freeEventsConfirmDescription', { title: confirming ? titleOf(confirming) : '' })}
        confirmLabel={t('supplier.freeEventsConfirmAction')}
        consequences={[
          t('supplier.freeEventsConfirmConsequence'),
          ...(confirming?.recurring ? [t('supplier.freeEventsConfirmConsequenceSeries')] : []),
        ]}
        isLoading={decide.isPending}
        onConfirm={() => (confirming ? send(confirming, 'Available') : undefined)}
      />
    </section>
  );
}
