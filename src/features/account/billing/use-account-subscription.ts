import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CHECKOUT_CONFIRM_POLL_MS,
  CHECKOUT_CONFIRM_TIMEOUT_MS,
  CHECKOUT_RETURN_PARAM,
  isPaidStatus,
  needsPaymentAction,
  readCheckoutReturn,
} from '@/features/billing/billing-utils';
import { useBillingSubscription, useRefreshPlanAfterPayment } from '@/queries/use-billing';
import type { BillingSubscription } from '@/types';

/** The return of a checkout is settled once Stripe reports a paid plan or a payment problem. */
export function isCheckoutSettled(subscription: BillingSubscription | undefined): boolean {
  return !!subscription && (isPaidStatus(subscription.status) || needsPaymentAction(subscription.status));
}

/**
 * The subscription of the org, and what the page does when Stripe has just sent the person back (`?checkout=success|cancel`, which the
 * plan and billing pages of the rental areas hand over with the query string). The outcome shown is the subscription read from the
 * backend, never the redirect alone: after a success it is read again until the webhook has confirmed the payment (or a minute has
 * passed), and the plan of the profile is read again once it is paid. The parameter is read once and then removed, so a reload does
 * not show the outcome again.
 */
export function useAccountSubscription() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [checkoutReturn] = useState(() => readCheckoutReturn(searchParams));
  const [timedOut, setTimedOut] = useState(false);
  const refreshPlan = useRefreshPlanAfterPayment();

  const subscriptionQuery = useBillingSubscription({
    pollInterval: (data) => (checkoutReturn === 'success' && !timedOut && !isCheckoutSettled(data) ? CHECKOUT_CONFIRM_POLL_MS : false),
  });
  const confirmed = checkoutReturn === 'success' && !!subscriptionQuery.data && isPaidStatus(subscriptionQuery.data.status);

  useEffect(() => {
    if (!searchParams.has(CHECKOUT_RETURN_PARAM)) return;
    const next = new URLSearchParams(searchParams);
    next.delete(CHECKOUT_RETURN_PARAM);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (checkoutReturn !== 'success') return;
    const timer = window.setTimeout(() => setTimedOut(true), CHECKOUT_CONFIRM_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [checkoutReturn]);

  useEffect(() => {
    if (confirmed) refreshPlan();
  }, [confirmed, refreshPlan]);

  return { subscriptionQuery, checkoutReturn, timedOut };
}
