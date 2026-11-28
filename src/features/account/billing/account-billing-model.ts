import { isLiveSubscription, needsPaymentAction } from '@/features/billing/billing-utils';
import type { BillingPlan, BillingSubscription, BillingSubscriptionStatus, Entitlement, PlanTier } from '@/types';

const UNLIMITED_FROM = 1_000_000;

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

export function readPlanUsage(entitlement: Entitlement | undefined): PlanUsage {
  return {
    properties: meterOf(entitlement?.usage?.properties, entitlement?.limits?.maxProperties),
    seats: meterOf(entitlement?.usage?.seats, entitlement?.limits?.maxSeats),
  };
}

export function pickShownTier(openAccess: boolean, subscription: BillingSubscription, effective: PlanTier | null): PlanTier {
  return openAccess ? subscription.planTier : (effective ?? subscription.planTier);
}

export function nextChargeAt(subscription: BillingSubscription): string | null {
  const { status, currentPeriodEnd } = subscription;
  return currentPeriodEnd && status !== 'canceled' && status !== 'none' ? currentPeriodEnd : null;
}

export function arePricesPending(plans: readonly BillingPlan[] | undefined, status: BillingSubscriptionStatus): boolean {
  return plans !== undefined && !isLiveSubscription(status) && !plans.some((plan) => plan.purchasable);
}

export type PlanNotice = 'openAccess' | 'openAccessPricesPending' | 'pricesPending';

export function pickPlanNotice(openAccess: boolean, pricesPending: boolean): PlanNotice | null {
  if (openAccess) return pricesPending ? 'openAccessPricesPending' : 'openAccess';
  return pricesPending ? 'pricesPending' : null;
}

export type PlanPrimary = 'fixPayment' | 'view' | 'choose' | 'change';

export function pickPlanPrimary(status: BillingSubscriptionStatus, pricesPending: boolean): PlanPrimary {
  if (needsPaymentAction(status)) return 'fixPayment';
  if (pricesPending) return 'view';
  return status === 'none' || status === 'canceled' ? 'choose' : 'change';
}

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

export function propertiesOverAllowance(plan: BillingPlan, used: number | undefined): number | null {
  if (used === undefined || plan.unitAllowance < 0 || used <= plan.unitAllowance) return null;
  return used;
}

export interface PortalHandle {
  open: () => void;
  pending: boolean;
}
