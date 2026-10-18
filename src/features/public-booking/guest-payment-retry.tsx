import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { getProblemMessage } from '@/lib/api-errors';
import { buildGuestBookingsPath } from '@/lib/booking-url';
import { GUEST_BOOKING_QUERY, useResumeGuestPayment } from '@/queries/use-guest-session';
import type { GuestBookingDetails, GuestSession } from '@/types';
import { StripeIntentPayment } from './components/stripe-intent-payment';

/** The states in which the guest can still pay: nothing was collected yet and the dates are held (or the charge failed). */
const PAYABLE_STATUSES: GuestBookingDetails['status'][] = ['AwaitingPayment', 'PaymentFailed'];

/**
 * "Riprova il pagamento" of "Le mie prenotazioni": after a declined card or a page closed before paying, the guest pays the same
 * hold again, with the same card or another payment method of the Payment Element. The backend answers the client secret of the
 * booking's own intent; once the hold has expired (409) the booking is read again and shows its new state.
 */
export function GuestPaymentRetry({
  session,
  booking,
  siteSlug,
}: {
  session: GuestSession;
  booking: GuestBookingDetails;
  siteSlug: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const resume = useResumeGuestPayment(session);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  if (!PAYABLE_STATUSES.includes(booking.status)) return null;

  const refreshBooking = () => void queryClient.invalidateQueries({ queryKey: [GUEST_BOOKING_QUERY] });
  const intent = resume.data;
  const clientSecret = intent?.clientSecret || intent?.setupIntentClientSecret;

  if (intent && clientSecret) {
    return (
      <section className="space-y-3 rounded-lg border p-6" data-testid="guest-payment-retry">
        <h4 className="text-sm font-semibold">{t('publicBooking.guestBookings.payment.title')}</h4>
        <StripeIntentPayment
          publishableKey={intent.connectedAccountPublishableContext.publishableKey}
          stripeAccountId={intent.connectedAccountPublishableContext.stripeAccountId}
          clientSecret={clientSecret}
          mode={intent.clientSecret ? 'payment' : 'setup'}
          returnUrl={`${window.location.origin}${buildGuestBookingsPath(siteSlug, booking.bookingCode)}`}
          onSubmitted={() => {
            setPaymentError(null);
            resume.reset();
            refreshBooking();
          }}
          onError={setPaymentError}
        />
        {paymentError && (
          <p className="text-sm text-destructive" role="alert" data-testid="guest-payment-retry-error">
            {paymentError}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-lg border p-6" data-testid="guest-payment-retry">
      <h4 className="text-sm font-semibold">{t('publicBooking.guestBookings.payment.title')}</h4>
      <p className="text-sm text-muted-foreground">{t('publicBooking.guestBookings.payment.description')}</p>
      {resume.isError && (
        <p className="text-sm text-destructive" role="alert" data-testid="guest-payment-retry-resume-error">
          {getProblemMessage(resume.error, t) ?? t('publicBooking.guestBookings.payment.resumeError')}
        </p>
      )}
      <Button
        className="w-full sm:w-auto"
        disabled={resume.isPending}
        onClick={() => resume.mutate(undefined, { onError: refreshBooking })}
        data-testid="guest-payment-retry-button"
      >
        {resume.isPending
          ? t('publicBooking.preparingPayment')
          : booking.status === 'PaymentFailed'
            ? t('publicBooking.guestBookings.payment.retry')
            : t('publicBooking.guestBookings.payment.complete')}
      </Button>
    </section>
  );
}
