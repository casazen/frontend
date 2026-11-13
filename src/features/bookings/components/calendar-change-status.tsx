import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { useCalendarChanges, useRetryCalendarChange } from '@/queries/use-calendar-changes';
import type { CalendarChange } from '@/types/calendar-changes.types';
import { canRetryChange, changeGroupOf, changeReasonKey } from '../lib/calendar-change-words';

/** How many of the last changes the list shows. */
const LIST_SIZE = 10;

interface CalendarChangeStatusProps {
  /** The name of a property of a change. */
  propertyName: (propertyId: string) => string;
  /** The caller may send a failed change again (`property.write`). */
  canRetry: boolean;
}

/** Why a change that was not sent was not: the code of its first failed property, else its own. */
function reasonOf(change: CalendarChange): string {
  return changeReasonKey(change.properties.find((property) => property.state === 'Failed')?.errorCode ?? change.errorCode);
}

/**
 * The line above the calendar about the changes sent to the channel manager (E08/F05/US03/T03, NF-36): while a change is waiting or being sent, or failed, it says so ("1 change is
 * being sent to your channel manager", "1 change was not sent"), with the list of the last changes (date, what, state) one click away, and it disappears when everything is delivered.
 * It reads `GET /api/calendar/changes` (the state words are those of the wizard result and of the panel of the days) every few seconds while a change is on its way, up to a time
 * (then a neutral "no answer yet" with "Check again"). A list that cannot be read is said, never taken for "all delivered"; a caller who may not read it gets nothing, and no error.
 * The buttons stay off while any request of the card is on its way.
 */
export function CalendarChangeStatus({ propertyName, canRetry }: CalendarChangeStatusProps) {
  const { t, i18n } = useTranslation();
  const changes = useCalendarChanges();
  const retry = useRetryCalendarChange();
  const [open, setOpen] = useState(false);

  // A caller with no right to read the changes is not told of an error: the calendar is what it was.
  if (changes.isError && getHttpStatus(changes.error) === 403) return null;

  const busy = retry.isPending;
  if (changes.isError) {
    return (
      <section aria-live="polite" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card px-4 py-3 text-sm" data-testid="calendar-change-status" data-state="unreadable">
        <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-[color:var(--color-warning-foreground,#8a4b05)]" />
        <p className="min-w-0 flex-1">{t('booking.calendar.change.list.unreadable')}</p>
        <Button type="button" size="sm" variant="outline" disabled={busy} loading={changes.isFetching} onClick={changes.checkAgain} data-testid="calendar-change-status-check">
          {t('booking.calendar.change.result.checkAgain')}
        </Button>
      </section>
    );
  }

  const list = changes.data ?? [];
  const waiting = list.filter((change) => changeGroupOf(change) === 'waiting');
  const failed = list.filter((change) => changeGroupOf(change) === 'failed');
  // Nothing is on its way and nothing failed: the line is gone (and so is the list of an earlier look).
  if (waiting.length === 0 && failed.length === 0) return null;

  const retryable = failed.filter(canRetryChange);

  return (
    <section aria-live="polite" className="space-y-3 rounded-xl border bg-card px-4 py-3 text-sm" data-testid="calendar-change-status" data-state={failed.length > 0 ? 'failed' : 'waiting'}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {failed.length > 0 ? (
          <p className="flex min-w-0 items-center gap-2 font-medium" data-testid="calendar-change-status-failed">
            <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-[color:var(--color-warning-foreground,#8a4b05)]" />
            {t('booking.calendar.change.list.failed', { count: failed.length })}
          </p>
        ) : null}
        {waiting.length > 0 ? (
          <p className="flex min-w-0 items-center gap-2" data-testid="calendar-change-status-waiting">
            <Loader2 aria-hidden="true" className="size-4 shrink-0 motion-safe:animate-spin" />
            {changes.watchOver ? t('booking.calendar.change.list.noAnswer', { count: waiting.length }) : t('booking.calendar.change.list.waiting', { count: waiting.length })}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {canRetry && retryable.length === 1 ? (
            <Button type="button" size="sm" variant="outline" disabled={busy} loading={retry.isPending} onClick={() => retry.mutate(retryable[0].id)} data-testid="calendar-change-status-retry">
              <RotateCw aria-hidden="true" className="size-4" />
              {t('booking.calendar.change.list.retry')}
            </Button>
          ) : null}
          {changes.watchOver ? (
            <Button type="button" size="sm" variant="outline" disabled={busy} loading={changes.isFetching} onClick={changes.checkAgain} data-testid="calendar-change-status-check">
              {t('booking.calendar.change.result.checkAgain')}
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen((previous) => !previous)} data-testid="calendar-change-status-toggle">
            {t('booking.calendar.change.list.toggle')}
            {open ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
          </Button>
        </div>
      </div>

      {retry.isError ? (
        <p role="alert" className="text-destructive" data-testid="calendar-change-status-retry-error">
          {getProblemMessage(retry.error, t) ?? t('booking.calendar.change.result.retryFailed')}
        </p>
      ) : null}

      {open ? (
        <ul className="divide-y rounded-lg border px-3" role="list" data-testid="calendar-change-list">
          {list.slice(0, LIST_SIZE).map((change) => (
            <li key={change.id} className="space-y-1 py-2" data-testid="calendar-change-row" data-state={change.state}>
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-medium">{formatRomeDateTime(change.requestedAt, i18n.language, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-foreground/70">
                  {t(`booking.calendar.change.list.kind.${change.kind}`)} · {change.properties.map((property) => propertyName(property.propertyId)).filter(Boolean).join(', ')}
                </span>
              </p>
              <p data-testid="calendar-change-row-state">{t(`booking.calendar.change.state.${change.state}`)}</p>
              {changeGroupOf(change) === 'failed' ? (
                <p className="text-foreground/80" data-testid="calendar-change-row-reason">
                  {t(reasonOf(change))}
                </p>
              ) : null}
              {canRetry && canRetryChange(change) ? (
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => retry.mutate(change.id)} data-testid="calendar-change-row-retry">
                  <RotateCw aria-hidden="true" className="size-4" />
                  {t('booking.calendar.change.result.retry')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
