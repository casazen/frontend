// US-004 (#202) tenant boundary — org + plan entitlement surfaced read-only on the frontend.

export type PlanTier = 'Starter' | 'Pro' | 'Scale';

/** Public projection of the caller's organization (AC9/AC11). Never carries Stripe/billing ids. */
export interface Org {
  id: string;
  name: string;
  slug: string;
  planTier: PlanTier;
}

export interface EntitlementLimits {
  maxProperties: number;
}

export interface EntitlementUsage {
  properties: number;
}

/** Resolved plan entitlement for the caller's org (AC8). Backs the plan badge + create gating. */
export interface Entitlement {
  orgId: string;
  planTier: PlanTier;
  limits: EntitlementLimits;
  usage: EntitlementUsage;
  canAddProperty: boolean;
}
