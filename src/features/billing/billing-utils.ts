import { getPublicSiteOrigin } from '@/config/public-site';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { isAxiosError } from 'axios';
import type { BillingSubscriptionStatus, CheckoutSessionRequest } from '@/types';

type TranslateFn = (key: string) => string;

/** 409 of the checkout: the org already has a subscription, it changes plan or pays from the portal (PL-10). */
export const ALREADY_SUBSCRIBED_CODE = 'already_subscribed';
/** 422 of the checkout: the plan has no Stripe price in this environment (PL-11). */
export const BILLING_PLAN_UNAVAILABLE_CODE = 'billing_plan_unavailable';
/** 409 of the checkout: the billing entry gate (P.IVA and SDI) is closed, nobody can be charged yet. */
export const BILLING_GATE_CLOSED_CODE = 'billing_gate_closed';

/**
 * Page the backend sends Stripe back to when the client gives no return URL (PL-11): `?checkout=success|cancel` after
 * the checkout, no parameter after the billing portal.
 */
export const DEFAULT_BILLING_RETURN_PATH = '/app/short-rent/settings/plan';

/** Query parameter of the Stripe Checkout return page. */
export const CHECKOUT_RETURN_PARAM = 'checkout';

export type CheckoutReturn = 'success' | 'cancel';

/** Polling of the subscription after the Stripe return, until the webhook confirms the payment. */
export const CHECKOUT_CONFIRM_POLL_MS = 3_000;
/** After this the page stops polling and tells the user the confirmation is still on its way. */
export const CHECKOUT_CONFIRM_TIMEOUT_MS = 60_000;

const STATUSES: readonly BillingSubscriptionStatus[] = [
  'active',
  'trialing',
  'past_due',
  'incomplete',
  'unpaid',
  'canceled',
  'none',
];

/** A status sent by the API; anything unknown is treated as no subscription. */
export function normalizeSubscriptionStatus(value: unknown): BillingSubscriptionStatus {
  return STATUSES.find((status) => status === value) ?? 'none';
}

/**
 * The subscription still exists on Stripe: a new checkout is refused (409 `already_subscribed`), the org changes plan
 * or pays from the billing portal. Mirror of the backend `BillingSubscriptionPolicy.BlocksNewCheckout`.
 */
export function isLiveSubscription(status: BillingSubscriptionStatus): boolean {
  return (
    status === 'active' ||
    status === 'trialing' ||
    status === 'past_due' ||
    status === 'unpaid' ||
    status === 'incomplete'
  );
}

/** A payment is due: past due (grace period), unpaid, or the first payment not completed. */
export function needsPaymentAction(status: BillingSubscriptionStatus): boolean {
  return status === 'past_due' || status === 'unpaid' || status === 'incomplete';
}

/** Paid access is confirmed after a checkout. */
export function isPaidStatus(status: BillingSubscriptionStatus): boolean {
  return status === 'active' || status === 'trialing';
}

export function readCheckoutReturn(params: URLSearchParams): CheckoutReturn | null {
  const value = params.get(CHECKOUT_RETURN_PARAM);
  return value === 'success' || value === 'cancel' ? value : null;
}

/**
 * Return pages of the checkout for the current page. None on the default page of the backend. On another page (e.g.
 * the plan page of another context) only when the app runs on the public site: the backend refuses any other origin
 * with 400, and a Vercel preview then gets the default pages.
 */
export function buildCheckoutReturnUrls(
  pathname: string,
  origin: string = window.location.origin,
  publicSiteOrigin: string | null = getPublicSiteOrigin(),
): Pick<CheckoutSessionRequest, 'successUrl' | 'cancelUrl'> {
  if (pathname === DEFAULT_BILLING_RETURN_PATH || !publicSiteOrigin || publicSiteOrigin !== origin) return {};
  const page = `${publicSiteOrigin}${pathname}`;
  return {
    successUrl: `${page}?${CHECKOUT_RETURN_PARAM}=success`,
    cancelUrl: `${page}?${CHECKOUT_RETURN_PARAM}=cancel`,
  };
}

/** Leaves the app for a Stripe page (checkout or portal); only absolute http(s) URLs. */
export function redirectToStripe(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid Stripe redirect URL');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Invalid Stripe redirect URL');
  window.location.assign(parsed.href);
}

/** VAT id as sent to the API: no spaces, dots or dashes, upper case. */
export function normalizeVatId(value: string): string {
  return value.replace(/[\s.-]/g, '').toUpperCase();
}

/**
 * Minimal shape check of a VAT id (letters and digits, 4-20 characters). The real check (VIES, reverse charge) is done
 * by the backend and Stripe (task PL-13).
 */
export function isVatIdShapeValid(value: string): boolean {
  return /^[A-Z0-9]{4,20}$/.test(normalizeVatId(value));
}

/** A UTC instant of the API shown as a calendar date in Europe/Rome; empty when invalid. */
export function formatBillingDate(instant: string, locale: string): string {
  const iso = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(instant) ? instant : `${instant}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Rome',
  }).format(date);
}

/** Monthly price with the currency of the API; empty when the currency is not valid. */
export function formatPlanPrice(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return '';
  }
}

/** Problem `code` of a failed API call. */
export function getErrorCode(error: unknown): string | undefined {
  return isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
}

/**
 * Message of a failed portal session. The backend answers 400 without a code while the org has no Stripe customer
 * (it has never started a checkout).
 */
export function getPortalErrorMessage(error: unknown, t: TranslateFn): string {
  if (getHttpStatus(error) === 400 && !getErrorCode(error)) return t('billing.portal.noCustomer');
  return getProblemMessage(error, t) ?? t('billing.portal.failed');
}

/**
 * Message of a refused billing profile. The profile endpoint answers 400 with an English text: the country is chosen
 * from the list, so a 400 means the VAT id was not accepted.
 */
export function getProfileErrorMessage(error: unknown, t: TranslateFn): string {
  if (getHttpStatus(error) === 400) return t('billing.profile.vatRejected');
  return getProblemMessage(error, t) ?? t('billing.profile.saveFailed');
}
