import { isLiveSubscription, needsPaymentAction } from '@/features/billing/billing-utils';
import type { BillingPlan, BillingSubscription, BillingSubscriptionStatus, Entitlement, PlanTier } from '@/types';

/** From this number a limit is "no limit": the backend sends int max, or -1, for a plan that has none (properties and seats). */
const UNLIMITED_FROM = 1_000_000;

/** What is used out of what the plan allows; `max` is `null` for a plan without a limit. */
export interface Meter {
  used: number;
  max: number | null;
}

export interface PlanUsage {
  properties: Meter | null;
  seats: Meter | null;
}

function meterOf(used: unknown, max: unknown): Meter | null {
  if (typeof used !== 'number' || typeof max !== 'number') return null;
  return { used, max: max < 0 || max >= UNLIMITED_FROM ? null : max };
}

/**
 * The two counts of the plan from the entitlement. One the backend did not send is `null` and the page leaves it out: an older
 * backend has no seats, and an answer that is not an entitlement at all (an HTML page where the API is not reachable) has nothing.
 */
export function readPlanUsage(entitlement: Entitlement | undefined): PlanUsage {
  return {
    properties: meterOf(entitlement?.usage?.properties, entitlement?.limits?.maxProperties),
    seats: meterOf(entitlement?.usage?.seats, entitlement?.limits?.maxSeats),
  };
}

/**
 * The plan the page calls "yours". Normally the one that applies now (Starter while a payment is not settled, whatever is stored);
 * with the open access the entitlement is raised above what is paid, so the plan of the person is the one stored: it is the one that
 * counts when the billing restarts, and the one the cards must not mark as already taken when the person wants a higher one.
 */
export function pickShownTier(openAccess: boolean, subscription: BillingSubscription, effective: PlanTier | null): PlanTier {
  return openAccess ? subscription.planTier : (effective ?? subscription.planTier);
}

/** The next charge is the end of the period of a subscription that goes on; none for a plan never paid or ended. */
export function nextChargeAt(subscription: BillingSubscription): string | null {
  const { status, currentPeriodEnd } = subscription;
  return currentPeriodEnd && status !== 'canceled' && status !== 'none' ? currentPeriodEnd : null;
}

/**
 * No plan can be bought and there is no subscription to change from the portal: the prices are not defined yet (AM-D28). The page then
 * says so, with no amounts and no "Cambia piano". Unknown while the plans are not read.
 */
export function arePricesPending(plans: readonly BillingPlan[] | undefined, status: BillingSubscriptionStatus): boolean {
  return plans !== undefined && !isLiveSubscription(status) && !plans.some((plan) => plan.purchasable);
}

export type PlanNotice = 'openAccess' | 'openAccessPricesPending' | 'pricesPending';

/** The one note under the plan, when there is something to say: the open access, or that the prices are not there yet, or both in one. */
export function pickPlanNotice(openAccess: boolean, pricesPending: boolean): PlanNotice | null {
  if (openAccess) return pricesPending ? 'openAccessPricesPending' : 'openAccess';
  return pricesPending ? 'pricesPending' : null;
}

/** What the button of the plan block does: pay what is due, look at the plans, pick the first one, or change the one in use. */
export type PlanPrimary = 'fixPayment' | 'view' | 'choose' | 'change';

export function pickPlanPrimary(status: BillingSubscriptionStatus, pricesPending: boolean): PlanPrimary {
  if (needsPaymentAction(status)) return 'fixPayment';
  if (pricesPending) return 'view';
  return status === 'none' || status === 'canceled' ? 'choose' : 'change';
}

/** What a plan offers: the plan in use, a change from the Stripe portal, a purchase through the checkout, or nothing yet. */
export type PlanAction = 'current' | 'portal' | 'unavailable' | 'checkout';

export function pickPlanAction(plan: BillingPlan, shownTier: PlanTier, status: BillingSubscriptionStatus): PlanAction {
  if (plan.tier === shownTier) return 'current';
  if (isLiveSubscription(status)) return 'portal';
  return plan.purchasable ? 'checkout' : 'unavailable';
}

/** The monthly price of a plan that can be bought, or `null`: an amount that is zero because nobody set it is never shown. */
export function planPrice(plan: BillingPlan): number | null {
  return plan.purchasable && plan.priceMonthly > 0 ? plan.priceMonthly : null;
}

export function formatPlanPrice(price: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
  }).format(price);
}

/**
 * How many properties the person has beyond what `plan` includes, or `null` when it fits. Going down is allowed: they all stay, but
 * no other can be added until the person is back within the limit (backend `OrgsController`), and the card says so.
 */
export function propertiesOverAllowance(plan: BillingPlan, used: number | undefined): number | null {
  if (used === undefined || plan.unitAllowance < 0 || used <= plan.unitAllowance) return null;
  return used;
}

/** What the cards and the blocks need to take the person to the Stripe billing portal: one mutation shared by the whole page. */
export interface PortalHandle {
  open: () => void;
  pending: boolean;
}
