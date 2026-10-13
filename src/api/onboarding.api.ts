import { ApiClient } from './client';
import type { OnboardingStatus } from '@/types/onboarding.types';

export const onboardingApi = {
  /** Activation checklist of the caller's org (PL-15): every step is derived from stored state on the server. */
  getStatus: () => ApiClient.get<OnboardingStatus>('/onboarding/status'),
};
