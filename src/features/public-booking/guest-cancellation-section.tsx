import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { useCancelFromGuestArea, useGuestCancellationPreview } from '@/queries/use-guest-cancellation';
import type { GuestBookingDetails, GuestBookingStatus, GuestSession } from '@/types';
import { CancellationClosed, CancellationPanel } from './components/cancellation-panel';

/**
 * The states of a booking in which the section says something: the ones that can be cancelled (a request or a payment that waits, a
 * confirmed booking, a stay in progress, which tells the guest to write to the host), and a cancelled booking, which tells what became of
 * its refund. An expired or declined request, dates that were lost and a stay that is over have nothing to cancel and nothing to refund.
 */
const CANCELLATION_STATUSES: readonly GuestBookingStatus[] = [
  'Confirmed',
  'AwaitingPayment',
  'PaymentProcessing',
  'PaymentFailed',
  'AwaitingGuestEmail',
  'AwaitingHostApproval',
  'StayInProgress',
  'Cancelled',
];

interface GuestCancellationSectionProps {
  session: GuestSession;
  booking: GuestBookingDetails;
}

/**
 * «Cancellazione» of the guest area (DB-08b), under the booking of "Le mie prenotazioni" (the {@link GuestAreaSlot} hooks it in): the
 * guest sees what they get back if they cancel today, according to the cancellation policy of the property, and cancels from here, with
 * no email in between. Every figure is the backend's; the guest confirms the amount they saw. A booking that was cancelled long ago with
 * nothing to refund has nothing to add to the card above and shows nothing.
 */
export function GuestCancellationSection({ session, booking }: GuestCancellationSectionProps) {
  if (!CANCELLATION_STATUSES.includes(booking.status)) return null;
  return <GuestCancellation session={session} booking={booking} />;
}

function GuestCancellation({ session, booking }: GuestCancellationSectionProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const preview = useGuestCancellationPreview(session);
  const cancel = useCancelFromGuestArea(session);

  // The session ended or the booking is not there: the page itself falls back to the form, nothing to say here.
  const failure = getHttpStatus(preview.error);
  if (preview.isError && (failure === 401 || failure === 404)) return null;

  const data = preview.data;
  const cancelledNow = cancel.isSuccess;
  // A booking cancelled earlier says nothing here unless a refund is on its way back (the card above already says it is cancelled), and
  // nothing is drawn while that is still being read: a frame that comes and goes would push the page around.
  const refundToTell = (data?.outcome?.refundAmount ?? 0) > 0;
  if (!cancelledNow && !refundToTell && (booking.status === 'Cancelled' || data?.reason === 'already_cancelled')) return null;

  return (
    <section aria-labelledby={headingId} className="space-y-3 rounded-lg border bg-card p-4 sm:p-5" data-testid="guest-cancellation">
      <div className="space-y-1">
        <h3 id={headingId} className="text-lg font-semibold">
          {t('guestCancellation.area.title')}
        </h3>
        {data?.cancellable && !cancelledNow && <p className="text-sm text-muted-foreground">{t('guestCancellation.area.intro')}</p>}
      </div>

      {preview.isPending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" data-testid="guest-cancellation-loading">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {t('guestCancellation.area.loading')}
        </p>
      )}

      {preview.isError && !data && (
        <div className="flex gap-3 rounded-lg bg-destructive/5 p-3 ring-1 ring-inset ring-destructive/30" role="alert" data-testid="guest-cancellation-error">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" aria-hidden="true" />
          <div className="space-y-2">
            <p className="text-sm text-destructive">{getProblemMessage(preview.error, t) ?? t('guestCancellation.area.loadError')}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void preview.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('guestCancellation.area.retry')}
            </Button>
          </div>
        </div>
      )}

      {data &&
        (data.cancellable || cancelledNow ? (
          <CancellationPanel preview={data} result={cancel.data ?? null} onCancel={(request) => cancel.mutateAsync(request)} />
        ) : (
          <CancellationClosed preview={data} hostEmail={booking.host.email} />
        ))}
    </section>
  );
}
