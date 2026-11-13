import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatStayDate } from '@/lib/stay-dates';
import type { Booking, OctorateVersion } from '@/types';
import { stayDateOf } from '../lib/booking-price';
import { syncReasonKey, syncRetriesByItself } from '../lib/octorate-sync';

interface BookingEditSyncProps {
  /** The booking as the detail reads it: its `octorateSync` is what the channel manager holds of the last thing CasaZen sent. */
  booking: Booking;
  /** Another call of the same page is under way (the save, the quote, asking again): nothing here can be started meanwhile. */
  busy: boolean;
  /** What the call that asked again answered when it refused (404, 409...), as a sentence; `null` when it did not. */
  retryError: string | null;
  /** "Retry now" asks for the push again; `overwrite` writes CasaZen's version over the one that changed in the channel manager. */
  onRetry: (overwrite: boolean) => void;
  /** The host chooses the version of the channel manager after a conflict: the page opens the form with its dates and guests. Missing when the form cannot take them. */
  onUseChannelVersion?: () => void;
  /** The page has stopped asking for a push that is still `Pending` (`useSyncWatch`): the line says that there is no answer yet, and offers «Check again». */
  waitOver?: boolean;
  /** «Check again» reads the booking once more and waits for one more minute. */
  onCheckAgain?: () => void;
  /** The booking is being read again (what «Check again» asked for). */
  checking?: boolean;
}

/**
 * Where the push of an edit to the channel manager stands (E08/F03/US02, NF-75, NF-74), read from `octorateSync` of the booking: being sent (or, once the page has stopped
 * waiting for it, not answered yet, with «Check again»), failed with its reason and "Retry now", or, for a change the channel manager refused because the reservation
 * changed there, in conflict with both versions and the two choices (any other refusal, as the dates of a creation taken there, is a failure with its reason). `Synced` says
 * nothing, and so does a booking that is not mirrored: this is a notice for what is not done, never a success the server did not confirm. A conflict is `role="alert"` by
 * hand: an `Alert` announces only the danger variant by itself.
 */
export function BookingEditSync({ booking, busy, retryError, onRetry, onUseChannelVersion, waitOver = false, onCheckAgain, checking = false }: BookingEditSyncProps) {
  const { t, i18n } = useTranslation();
  const sync = booking.octorateSync;
  if (!sync || sync.state === 'Synced') return null;

  if (sync.state === 'Pending') {
    // A push that is still `Pending` when the page stopped asking is not "being sent" any more as far as this page knows: it says that nothing has come back, which is
    // neither a success nor a failure, and lets the host look again.
    if (waitOver) {
      return (
        <Alert
          variant="info"
          data-testid="booking-sync-waiting"
          action={
            onCheckAgain ? (
              <Button size="sm" variant="outline" disabled={busy} loading={checking} onClick={onCheckAgain} data-testid="booking-sync-check-again">
                {t('booking.edit.sync.checkAgain')}
              </Button>
            ) : undefined
          }
        >
          {t('booking.edit.sync.waiting')}
        </Alert>
      );
    }

    return (
      <p role="status" className="text-sm text-muted-foreground" data-testid="booking-sync-pending">
        {t('booking.edit.sync.pending')}
      </p>
    );
  }

  if (sync.state === 'NotAllowedByChannel') {
    return (
      <Alert variant="info" data-testid="booking-sync-not-allowed">
        {t('booking.edit.sync.notAllowed')}
      </Alert>
    );
  }

  const retryButton = (overwrite: boolean) => (
    <Button
      size="sm"
      variant={overwrite ? 'default' : 'outline'}
      disabled={busy}
      onClick={() => onRetry(overwrite)}
      data-testid={overwrite ? 'booking-sync-keep-casazen' : 'booking-sync-retry'}
    >
      {overwrite ? t('booking.edit.conflict.keepCasazen') : t('booking.edit.sync.retry')}
    </Button>
  );

  // Two versions can be in conflict only for a change CasaZen sent (`Update`): the reservation changed in the channel manager after CasaZen read it. The refusal of anything
  // else is no booking changed over there: a creation whose dates are taken in the channel manager (`octorate_dates_unavailable`) has no reservation to differ from. It is
  // a failure like the others: it says why, and the choice is to ask again once the problem is sorted out.
  const versionsInConflict = sync.state === 'Conflict' && sync.lastOperation === 'Update';

  if (sync.state === 'Failed' || (sync.state === 'Conflict' && !versionsInConflict)) {
    return (
      <Alert
        variant="warning"
        role="alert"
        title={t('booking.edit.sync.failed.title')}
        data-testid="booking-sync-failed"
        data-state={sync.state}
        data-code={sync.errorCode ?? undefined}
        action={sync.canRetry ? retryButton(false) : undefined}
      >
        <div className="space-y-1">
          <p>{t(syncReasonKey(sync.errorCode))}</p>
          {syncRetriesByItself(sync.errorCode) ? (
            <p>{t('booking.edit.sync.failed.retrying')}</p>
          ) : sync.canRetry ? (
            <p>{t('booking.edit.sync.failed.askAgain')}</p>
          ) : null}
          {retryError && <p className="text-destructive">{retryError}</p>}
        </div>
      </Alert>
    );
  }

  // `Conflict` of a change: the reservation changed in the channel manager after CasaZen read it. Both versions are shown and neither is lost until the host decides.
  const day = (value: string | null | undefined) =>
    value ? formatStayDate(stayDateOf(value), i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }) : t('booking.edit.conflict.notAvailable');
  const stay = (checkIn: string | null | undefined, checkOut: string | null | undefined) => `${day(checkIn)} → ${day(checkOut)}`;
  const guests = (count: number | null | undefined) => (typeof count === 'number' ? t('booking.list.guestCount', { count }) : t('booking.edit.conflict.notAvailable'));
  const theirs: OctorateVersion | null | undefined = sync.octorateVersion;

  return (
    <Alert
      variant="warning"
      role="alert"
      title={t('booking.edit.conflict.title')}
      data-testid="booking-sync-conflict"
      action={
        <>
          {sync.canRetry && retryButton(true)}
          {onUseChannelVersion && (
            <Button size="sm" variant="outline" disabled={busy} onClick={onUseChannelVersion} data-testid="booking-sync-use-channel">
              {t('booking.edit.conflict.useChannelManager')}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3">
        <p>{t('booking.edit.conflict.description')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <section aria-label={t('booking.edit.conflict.casazen')} data-testid="booking-conflict-casazen">
            <h3 className="font-medium">{t('booking.edit.conflict.casazen')}</h3>
            <p>{stay(booking.checkInDate, booking.checkOutDate)}</p>
            <p>{guests(booking.numberOfGuests)}</p>
          </section>
          <section aria-label={t('booking.edit.conflict.channelManager')} data-testid="booking-conflict-channel">
            <h3 className="font-medium">{t('booking.edit.conflict.channelManager')}</h3>
            <p>{stay(theirs?.checkIn, theirs?.checkOut)}</p>
            <p>{guests(theirs?.guests)}</p>
          </section>
        </div>
        {sync.canRetry && <p className="text-xs">{t('booking.edit.conflict.keepCasazenHint')}</p>}
        {onUseChannelVersion && <p className="text-xs">{t('booking.edit.conflict.useChannelManagerHint')}</p>}
        {retryError && <p className="text-destructive">{retryError}</p>}
      </div>
    </Alert>
  );
}
