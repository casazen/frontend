import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { getProblemMessage } from '@/lib/api-errors';
import { useDecideFreeEvent } from '@/queries/supplier/use-calendar';
import type { FreeEventDecision, PendingFreeEvent } from '@/types/supplier';
import { describeFreeEventWhen } from '../lib/free-events';

interface FreeEventsBannerProps {
  items: readonly PendingFreeEvent[];
  pendingCount: number;
  /** A sync is running (it was queued by an "Available" answer): the days are about to be refreshed. */
  syncing?: boolean;
}

/**
 * Calendar events marked "Disponibile" that block their days until the supplier answers: the one block of the page that asks for
 * something, in the calm look of the focus block (a tinted block, an icon, the words say it; the rows inside are plain, no box in a
 * box). Titles are personal data: they are shown here, to the owner, and nowhere else.
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
  const detailOf = (event: PendingFreeEvent) =>
    [
      describeFreeEventWhen(event, i18n.language),
      event.isAllDay ? t('supplier.freeEventsAllDay') : null,
      event.recurring ? t('supplier.freeEventsRecurring', { count: event.occurrences }) : null,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <section aria-labelledby="free-events-title" className="w-full" data-testid="free-events-banner">
      <div className="flex min-w-0 flex-col gap-3 rounded-xl bg-warning-soft p-4 ring-1 ring-inset ring-warning-border forced-colors:outline-1 sm:flex-row sm:gap-4 sm:p-6">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-background text-warning-foreground sm:size-12">
          <AlertTriangle className="size-5 sm:size-6" />
        </span>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-2">
            <h2 id="free-events-title" className="break-words text-lg font-semibold leading-snug sm:text-xl">
              {t('supplier.freeEventsBannerTitle', { count: pendingCount })}
            </h2>
            <p className="break-words text-sm text-foreground/80 sm:text-base">{t('supplier.freeEventsBannerHint')}</p>
            {syncing ? (
              <p className="flex items-center gap-1.5 text-sm text-foreground/70" data-testid="free-events-syncing">
                <Loader2 className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                {t('supplier.freeEventsSyncing')}
              </p>
            ) : null}
          </div>

          <ul className="w-full divide-y divide-warning-border" aria-label={t('supplier.freeEventsListLabel')}>
            {items.map((event) => {
              const title = titleOf(event);
              const busy = busyId === event.id;
              return (
                <li
                  key={event.id}
                  className="flex w-full flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  data-testid={`free-event-${event.id}`}
                >
                  <div className="min-w-0">
                    <p className="break-words font-semibold">{title}</p>
                    <p className="break-words text-sm text-foreground/70">{detailOf(event)}</p>
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
                        <Loader2 className="mr-1 h-3 w-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      ) : null}
                      {t('supplier.freeEventsBusyCta')}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

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
