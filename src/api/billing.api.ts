import { ApiClient } from './client';
import type {
  BillingProfileDto,
  CheckoutSessionRequest,
  CheckoutSessionResponse,
  PlanDto,
  PortalSessionResponse,
  SubscriptionDto,
  UpdateBillingProfileRequest,
} from '@/types/billing.types';

export const BillingApi = {
  getPlans: (): Promise<PlanDto[]> =>
    ApiClient.get<PlanDto[]>('/billing/plans'),

  createCheckoutSession: (data: CheckoutSessionRequest): Promise<CheckoutSessionResponse> =>
    ApiClient.post<CheckoutSessionResponse>('/billing/checkout-session', data),

  createPortalSession: (): Promise<PortalSessionResponse> =>
    ApiClient.post<PortalSessionResponse>('/billing/portal-session'),

  getSubscription: (): Promise<SubscriptionDto> =>
    ApiClient.get<SubscriptionDto>('/billing/subscription'),

  updateBillingProfile: (data: UpdateBillingProfileRequest): Promise<BillingProfileDto> =>
    ApiClient.put<BillingProfileDto>('/billing/profile', data),
};
