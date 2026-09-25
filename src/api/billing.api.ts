import { ApiClient } from '@/api/client';
import type {
  BillingPlan,
  BillingProfile,
  BillingProfileRequest,
  BillingSubscription,
  CheckoutSessionRequest,
  CheckoutSessionResponse,
  PortalSessionResponse,
} from '@/types';

/** SaaS billing of the caller's org on the CasaZen platform account (backend `BillingController`). */
export const BillingApi = {
  getPlans: (): Promise<BillingPlan[]> => ApiClient.get<BillingPlan[]>('/billing/plans'),

  /** Org billing administrator only (policy `OrgBillingAdmin`). */
  getSubscription: (): Promise<BillingSubscription> => ApiClient.get<BillingSubscription>('/billing/subscription'),

  /**
   * Stripe Checkout of a plan. 409 `already_subscribed` (the org pays from the portal), 409 `billing_gate_closed`,
   * 422 `billing_plan_unavailable` (no Stripe price in this environment).
   */
  createCheckoutSession: (request: CheckoutSessionRequest): Promise<CheckoutSessionResponse> =>
    ApiClient.post<CheckoutSessionResponse>('/billing/checkout-session', request),

  /**
   * Stripe customer portal: plan change, payment method, open invoices. 400 while the org has no Stripe customer.
   * `returnPath`: the plan or billing page the portal links back to (PL-16); omitted = the backend default page.
   */
  createPortalSession: (returnPath?: string): Promise<PortalSessionResponse> =>
    ApiClient.post<PortalSessionResponse>('/billing/portal-session', returnPath ? { returnPath } : undefined),

  updateProfile: (request: BillingProfileRequest): Promise<BillingProfile> =>
    ApiClient.put<BillingProfile>('/billing/profile', request),
};
