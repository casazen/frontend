import { ApiClient } from '@/api/client';
import type { ConnectStatus, OnboardingLinkResponse } from '@/types/connect.types';

export const ConnectApi = {
  createAccount: (): Promise<ConnectStatus> =>
    ApiClient.post<ConnectStatus>('/connect/account'),

  /**
   * Stripe onboarding link. The return and refresh pages are built by the API on the configured public domain
   * (BK-09, A3-42): the client sends no URL.
   */
  createOnboardingLink: (): Promise<OnboardingLinkResponse> =>
    ApiClient.post<OnboardingLinkResponse>('/connect/onboarding-link'),

  getStatus: (refresh = true): Promise<ConnectStatus> =>
    ApiClient.get<ConnectStatus>('/connect/status', { refresh }),
};
