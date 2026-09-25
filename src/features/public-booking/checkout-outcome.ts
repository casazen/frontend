import type { CheckoutOutcomeState } from '@/types';

/**
 * What the browser knows about the guest's own payment attempt: the result of `confirmPayment` / `confirmSetup`, or the
 * `redirect_status` Stripe appends to the `return_url` of a redirect method. It is only a hint for the page: the booking
 * is confirmed only when the backend says so.
 */
export type ClientPaymentStatus = 'succeeded' | 'processing' | 'failed';

/** What the outcome page shows. */
export type OutcomeView =
  | 'confirmed'
  | 'processing'
  | 'failed'
  | 'awaitingPayment'
  | 'awaitingEmail'
  | 'awaitingHost'
  | 'expired'
  | 'declined'
  | 'datesUnavailable'
  | 'cancelled';

/** `redirect_status` of a Stripe `return_url` (`succeeded`, `processing`, `failed`, …) as a client status. */
export function clientStatusFromRedirect(value: string | null | undefined): ClientPaymentStatus | null {
  switch (value) {
    case 'succeeded':
      return 'succeeded';
    case 'processing':
      return 'processing';
    case 'failed':
    case 'requires_payment_method':
    case 'canceled':
      return 'failed';
    default:
      return null;
  }
}

/** Status of a PaymentIntent / SetupIntent returned by Stripe.js as a client status. */
export function clientStatusFromIntent(status: string | null | undefined): ClientPaymentStatus | null {
  switch (status) {
    case 'succeeded':
      return 'succeeded';
    case 'processing':
    case 'requires_capture':
      return 'processing';
    case 'requires_payment_method':
    case 'canceled':
      return 'failed';
    default:
      return null;
  }
}

/**
 * The view for the backend state, refined by what the browser knows: a payment that Stripe.js reports as succeeded is
 * "being confirmed" until the webhook confirms the booking, never "confirmed".
 */
export function resolveOutcomeView(state: CheckoutOutcomeState, client: ClientPaymentStatus | null): OutcomeView {
  switch (state) {
    case 'Confirmed':
      return 'confirmed';
    case 'PaymentProcessing':
      return 'processing';
    case 'AwaitingGuestEmail':
      return 'awaitingEmail';
    case 'AwaitingHostApproval':
      return 'awaitingHost';
    case 'Expired':
      return 'expired';
    case 'Declined':
      return 'declined';
    case 'DatesUnavailable':
      return 'datesUnavailable';
    case 'Cancelled':
      return 'cancelled';
    case 'AwaitingPayment':
    case 'PaymentFailed':
      if (client === 'succeeded' || client === 'processing') return 'processing';
      if (client === 'failed' || state === 'PaymentFailed') return 'failed';
      return 'awaitingPayment';
  }
}

/**
 * Whether the page keeps polling: while someone else still has to act (Stripe and its webhook, the guest's email
 * confirmation in another tab, the host). An expired hold is polled too when the guest has paid: a late payment is
 * confirmed again or refunded by the backend (BK-04).
 */
export function isIntermediateView(view: OutcomeView, client: ClientPaymentStatus | null): boolean {
  if (view === 'processing' || view === 'awaitingEmail' || view === 'awaitingHost') return true;
  return view === 'expired' && (client === 'succeeded' || client === 'processing');
}

/** Polls per round: about 7 minutes with the backoff below. Then the page offers "Aggiorna lo stato". */
export const MAX_POLL_ATTEMPTS = 20;

const FIRST_POLL_DELAY_MS = 2_000;
const MAX_POLL_DELAY_MS = 30_000;

/** Delay before poll number `attempt` (0-based): 2 s, 3 s, 4.5 s… up to 30 s. */
export function nextPollDelay(attempt: number): number {
  return Math.min(MAX_POLL_DELAY_MS, Math.round(FIRST_POLL_DELAY_MS * 1.5 ** Math.max(0, attempt)));
}

/** Final views: nothing will change without the guest (the pending checkout can be forgotten). */
export function isFinalView(view: OutcomeView): boolean {
  return view === 'confirmed' || view === 'expired' || view === 'declined' || view === 'datesUnavailable' || view === 'cancelled';
}
