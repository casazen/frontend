// SaaS subscription billing of the org on the CasaZen platform account (spec-saas-billing AC10-AC13, PL-12).
import type { PlanTier } from './org.types';

/**
 * Subscription status of `GET /api/billing/subscription` (backend `BillingController.Map`, PL-10). Only `active`,
 * `trialing` and `past_due` within the grace period give paid access; `none` means never subscribed.
 */
export type BillingSubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'incomplete'
  | 'unpaid'
  | 'canceled'
  | 'none';

/** Plan of `GET /api/billing/plans`. */
export interface BillingPlan {
  tier: PlanTier;
  displayName: string;
  /** Monthly price from the backend configuration (`Billing:Display:<Tier>:PriceMonthly`); 0 when not configured. */
  priceMonthly: number;
  currency: string;
  /** Maximum number of properties; -1 means unlimited. */
  unitAllowance: number;
  features: string[];
  /** False when the plan has no Stripe price in this environment: its checkout answers 422 `billing_plan_unavailable`. */
  purchasable: boolean;
}

/** `GET /api/billing/subscription`. */
export interface BillingSubscription {
  /** Tier stored on the org; the tier actually granted is the effective one of `/users/me`. */
  planTier: PlanTier;
  status: BillingSubscriptionStatus;
  /** End of the current billing period (UTC instant), when Stripe sent one. */
  currentPeriodEnd: string | null;
  seats: number;
  billingCountry: string | null;
  vatId: string | null;
}

/** `POST /api/billing/checkout-session`. */
export interface CheckoutSessionRequest {
  planTier: PlanTier;
  /** ISO 3166-1 alpha-2. */
  billingCountry: string;
  vatId?: string;
  /** Absolute URL on the public site (`App__PublicSiteBaseUrl`); omitted = the default plan page. */
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutSessionResponse {
  checkoutUrl: string;
}

export interface PortalSessionResponse {
  portalUrl: string;
}

/** `PUT /api/billing/profile`. */
export interface BillingProfileRequest {
  billingCountry: string;
  vatId?: string;
}

export interface BillingProfile {
  billingCountry: string;
  vatId: string | null;
  viesValidated: boolean | null;
}
