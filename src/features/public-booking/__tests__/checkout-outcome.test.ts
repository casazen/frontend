import { describe, expect, it } from 'vitest';
import {
  MAX_POLL_ATTEMPTS,
  clientStatusFromIntent,
  clientStatusFromRedirect,
  isFinalView,
  isIntermediateView,
  nextPollDelay,
  resolveOutcomeView,
} from '../checkout-outcome';

describe('checkout outcome', () => {
  it('resolveOutcomeView_PaymentSucceededInTheBrowserButNotConfirmedByTheBackend_IsProcessingNotConfirmed', () => {
    expect(resolveOutcomeView('AwaitingPayment', 'succeeded')).toBe('processing');
    expect(resolveOutcomeView('PaymentFailed', 'processing')).toBe('processing');
    expect(resolveOutcomeView('Confirmed', null)).toBe('confirmed');
  });

  it('resolveOutcomeView_FailedAttempt_IsFailedWhateverTheSource', () => {
    expect(resolveOutcomeView('AwaitingPayment', 'failed')).toBe('failed');
    expect(resolveOutcomeView('PaymentFailed', null)).toBe('failed');
    expect(resolveOutcomeView('AwaitingPayment', null)).toBe('awaitingPayment');
  });

  it('resolveOutcomeView_BackendFinalStates_WinOverTheBrowser', () => {
    expect(resolveOutcomeView('Expired', 'succeeded')).toBe('expired');
    expect(resolveOutcomeView('DatesUnavailable', 'succeeded')).toBe('datesUnavailable');
    expect(resolveOutcomeView('Declined', null)).toBe('declined');
    expect(resolveOutcomeView('Cancelled', null)).toBe('cancelled');
    expect(resolveOutcomeView('AwaitingGuestEmail', null)).toBe('awaitingEmail');
    expect(resolveOutcomeView('AwaitingHostApproval', null)).toBe('awaitingHost');
    expect(resolveOutcomeView('PaymentProcessing', null)).toBe('processing');
  });

  it('clientStatusFromRedirect_StripeRedirectStatus_MapsToWhatTheBrowserKnows', () => {
    expect(clientStatusFromRedirect('succeeded')).toBe('succeeded');
    expect(clientStatusFromRedirect('processing')).toBe('processing');
    expect(clientStatusFromRedirect('failed')).toBe('failed');
    expect(clientStatusFromRedirect('requires_payment_method')).toBe('failed');
    expect(clientStatusFromRedirect(null)).toBeNull();
    expect(clientStatusFromRedirect('something-else')).toBeNull();
  });

  it('clientStatusFromIntent_IntentStatus_MapsToWhatTheBrowserKnows', () => {
    expect(clientStatusFromIntent('succeeded')).toBe('succeeded');
    expect(clientStatusFromIntent('processing')).toBe('processing');
    expect(clientStatusFromIntent('requires_payment_method')).toBe('failed');
    expect(clientStatusFromIntent('requires_action')).toBeNull();
  });

  it('isIntermediateView_OnlyWhileSomeoneElseMustAct', () => {
    expect(isIntermediateView('processing', null)).toBe(true);
    expect(isIntermediateView('awaitingEmail', null)).toBe(true);
    expect(isIntermediateView('awaitingHost', null)).toBe(true);
    expect(isIntermediateView('failed', null)).toBe(false);
    expect(isIntermediateView('confirmed', null)).toBe(false);
    // A late payment may still be confirmed again or refunded (BK-04).
    expect(isIntermediateView('expired', 'succeeded')).toBe(true);
    expect(isIntermediateView('expired', null)).toBe(false);
    expect(isFinalView('expired')).toBe(true);
    expect(isFinalView('processing')).toBe(false);
  });

  it('nextPollDelay_Backoff_GrowsAndIsCapped', () => {
    expect(nextPollDelay(0)).toBe(2_000);
    expect(nextPollDelay(1)).toBe(3_000);
    expect(nextPollDelay(2)).toBe(4_500);
    expect(nextPollDelay(MAX_POLL_ATTEMPTS)).toBe(30_000);
    const total = Array.from({ length: MAX_POLL_ATTEMPTS }, (_, attempt) => nextPollDelay(attempt)).reduce(
      (sum, delay) => sum + delay,
      0,
    );
    // One round of polling lasts minutes, not hours.
    expect(total).toBeLessThan(10 * 60_000);
  });
});
