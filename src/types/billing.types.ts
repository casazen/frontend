import type { PlanTier } from './org.types';

export type BillingSubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'incomplete'
  | 'unpaid'
  | 'canceled'
  | 'none';

export interface BillingPlan {
  tier: PlanTier;
  displayName: string;
  priceMonthly: number;
  pricesIncludeVat?: boolean;
  agencyTariff?: { purchasable: boolean; minimum: number; quoteFrom: number; bands: { upTo: number; unitPrice: number }[] } | null;
  billingUnit?: 'room' | 'plan';
  currency: string;
  unitAllowance: number;
  features: string[];
  purchasable: boolean;
}

export interface BillingSubscription {
  roomQuantity?: number;
  enabledAddons?: string[];
  planTier: PlanTier;
  status: BillingSubscriptionStatus;
  currentPeriodEnd: string | null;
  seats: number;
  billingCountry: string | null;
  vatId: string | null;
  sdiRecipientCode?: string | null;
  pecEmail?: string | null;
  fiscalCode?: string | null;
}

export interface CheckoutSessionRequest {
  planTier: PlanTier;
  commercialSignup?: import('@/features/onboarding/commercial-model').CommercialSelection;
  billingCountry: string;
  vatId?: string;
  returnPath?: string;
}

export interface CheckoutSessionResponse {
  checkoutUrl: string;
}

export interface PortalSessionResponse {
  portalUrl: string;
}

export interface BillingProfileRequest {
  billingCountry: string;
  vatId?: string;
}

export interface BillingProfile {
  billingCountry: string;
  vatId: string | null;
  viesValidated: boolean | null;
}
