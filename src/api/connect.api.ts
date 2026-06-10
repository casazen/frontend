import { ApiClient } from '@/api/client';
import type { ConnectStatus, OnboardingLinkResponse } from '@/types/connect.types';

export const ConnectApi = {
  createAccount: (): Promise<ConnectStatus> =>
    ApiClient.post<ConnectStatus>('/connect/account'),

  createOnboardingLink: (returnUrl: string, refreshUrl: string): Promise<OnboardingLinkResponse> =>
    ApiClient.post<OnboardingLinkResponse>('/connect/onboarding-link', { returnUrl, refreshUrl }),

  getStatus: (refresh = true): Promise<ConnectStatus> =>
    ApiClient.get<ConnectStatus>('/connect/status', { refresh }),
};
