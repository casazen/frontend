import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { Booking } from '@/types';
import { syncReasonKey, syncRetriesByItself } from '../lib/octorate-sync';

interface BookingCancelSyncProps {
  /** The booking as the detail reads it, after the cancellation: its `octorateSync` is what the channel manager holds of the last thing CasaZen sent. */
  booking: Booking;
  /** Another call of the dialog is under way: nothing here can be started meanwhile. */
  busy: boolean;
  /** What the call that asked again answered when it refused (404, 409...), as a sentence; `null` when it did not. */
  retryError: string | null;
  /** "Retry now" asks for the cancellation to be sent again. */
  onRetry: () => void;
  /** The dialog has stopped asking for a cancellation that is still `Pending` (`useSyncWatch`): the line says that there is no answer yet, and offers «Check again». */
  waitOver?: boolean;
  /** «Check again» reads the booking once more and waits for one more minute. */
  onCheckAgain?: () => void;
  /** The booking is being read again (what «Check again» asked for). */
  checking?: boolean;
}

/**
 * The line of the channel manager in the result of a cancellation (E08/F03/US02, NF-76, AC-NF76-1): the cancellation is made in CasaZen first and sent after, so the refunds
 * above it never wait for this line. Being sent, cancelled there too, failed with its reason and "Retry now", or refused because the reservation changed there. The row says
 * what the last thing CasaZen sent stands at: until that is the cancellation it still says an older thing, and the line says only that the channel manager has not
 * confirmed the cancellation, never a success it did not give. A cancellation that is still being sent when the dialog has stopped waiting for it is said as not answered yet,
 * with «Check again». Nothing for a booking that is not mirrored.
 */
export function BookingCancelSync({ booking, busy, retryError, onRetry, waitOver = false, onCheckAgain, checking = false }: BookingCancelSyncProps) {
  const { t } = useTranslation();
  const sync = booking.octorateSync;
  if (!sync) return null;

  if (sync.lastOperation !== 'Cancel') {
    return (
      <p role="status" className="text-sm text-muted-foreground" data-testid="booking-cancel-sync-unconfirmed">
        {t('booking.cancel.sync.unconfirmed')}
      </p>
    );
  }

  if (sync.state === 'Synced') {
    return (
      <p role="status" className="text-sm text-green-700" data-testid="booking-cancel-sync-synced">
        {t('booking.cancel.sync.synced')}
      </p>
    );
  }

  if (sync.state === 'Pending') {
    // Still `Pending` when the dialog stopped asking: nothing has come back, which is neither a cancellation sent nor a failure, and the host can look again.
    if (waitOver) {
      return (
        <Alert
          variant="info"
          data-testid="booking-cancel-sync-waiting"
          action={
            onCheckAgain ? (
              <Button size="sm" variant="outline" disabled={busy} loading={checking} onClick={onCheckAgain} data-testid="booking-cancel-sync-check-again">
                {t('booking.cancel.sync.checkAgain')}
              </Button>
            ) : undefined
          }
        >
          {t('booking.cancel.sync.waiting')}
        </Alert>
      );
    }

    return (
      <p role="status" className="text-sm text-yellow-700" data-testid="booking-cancel-sync-pending">
        {t('booking.cancel.sync.pending')}
      </p>
    );
  }

  if (sync.state === 'NotAllowedByChannel') {
    return (
      <p role="status" className="text-sm" data-testid="booking-cancel-sync-not-allowed">
        {t('booking.cancel.sync.notAllowed')}
      </p>
    );
  }

  // `Failed`, or `Conflict`: the reservation changed in the channel manager and it did not accept the cancellation. The cancellation in CasaZen stands either way.
  return (
    <Alert
      variant="warning"
      role="alert"
      title={sync.state === 'Conflict' ? t('booking.cancel.sync.conflict') : t('booking.cancel.sync.failed.title')}
      data-testid="booking-cancel-sync-failed"
      data-state={sync.state}
      data-code={sync.errorCode ?? undefined}
      action={
        sync.canRetry ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={onRetry} data-testid="booking-cancel-sync-retry">
            {t('booking.cancel.sync.retry')}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-1">
        <p>{t(syncReasonKey(sync.errorCode))}</p>
        {sync.state === 'Failed' && syncRetriesByItself(sync.errorCode) ? (
          <p>{t('booking.cancel.sync.failed.retrying')}</p>
        ) : sync.canRetry ? (
          <p>{t('booking.cancel.sync.failed.askAgain')}</p>
        ) : null}
        {retryError && <p className="text-destructive">{retryError}</p>}
      </div>
    </Alert>
  );
}
