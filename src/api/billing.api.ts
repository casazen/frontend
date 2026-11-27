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

export const BillingApi = {
  getPlans: (): Promise<BillingPlan[]> => ApiClient.get<BillingPlan[]>('/billing/plans'),

  getSubscription: (): Promise<BillingSubscription> => ApiClient.get<BillingSubscription>('/billing/subscription'),

  createCheckoutSession: (request: CheckoutSessionRequest): Promise<CheckoutSessionResponse> =>
    ApiClient.post<CheckoutSessionResponse>('/billing/checkout-session', request),

  createPortalSession: (returnPath?: string): Promise<PortalSessionResponse> =>
    ApiClient.post<PortalSessionResponse>('/billing/portal-session', returnPath ? { returnPath } : undefined),

  updateProfile: (request: BillingProfileRequest): Promise<BillingProfile> =>
    ApiClient.put<BillingProfile>('/billing/profile', request),
};
