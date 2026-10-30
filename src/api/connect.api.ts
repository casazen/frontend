import { ApiClient } from '@/api/client';
import type { ConnectStatus, DashboardLinkResponse, OnboardingLinkResponse } from '@/types/connect.types';

export const ConnectApi = {
  createAccount: (): Promise<ConnectStatus> =>
    ApiClient.post<ConnectStatus>('/connect/account'),

  /**
   * Stripe onboarding link. The return and refresh pages are built by the API on the configured public domain
   * (BK-09, A3-42): the client sends no URL.
   */
  createOnboardingLink: (): Promise<OnboardingLinkResponse> =>
    ApiClient.post<OnboardingLinkResponse>('/connect/onboarding-link'),

  /**
   * Single-use login link to the Express Dashboard of the org's own Stripe account (AM-08b-d, «Gestisci su Stripe»): balance, payouts and
   * bank details live there. Only for an account that is already linked and verified (422 `stripe_connect_dashboard_not_ready` otherwise).
   */
  createDashboardLink: (): Promise<DashboardLinkResponse> =>
    ApiClient.post<DashboardLinkResponse>('/connect/dashboard-link'),

  getStatus: (refresh = true): Promise<ConnectStatus> =>
    ApiClient.get<ConnectStatus>('/connect/status', { refresh }),
};
