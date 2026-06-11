import type { PlanTier } from './org.types';

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'none';

export interface PlanDto {
  tier: PlanTier;
  displayName: string;
  priceMonthly: number;
  currency: string;
  unitAllowance: number;
  features: string[];
  stripePriceId: string;
}

export interface SubscriptionDto {
  planTier: PlanTier;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  seats: number;
  billingCountry: string | null;
  vatId: string | null;
  stripeCustomerId: string | null;
}

export interface CheckoutSessionRequest {
  planTier: PlanTier;
  billingCountry: string;
  vatId?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutSessionResponse {
  checkoutUrl: string;
}

export interface PortalSessionResponse {
  portalUrl: string;
}

export interface UpdateBillingProfileRequest {
  billingCountry: string;
  vatId?: string;
}

export interface BillingProfileDto {
  billingCountry: string;
  vatId?: string | null;
  viesValidated?: boolean | null;
}
