import { useQuery } from '@tanstack/react-query';
import { onboardingApi } from '@/api/onboarding.api';

export const ONBOARDING_STATUS_KEY = ['onboarding', 'status'] as const;

/**
 * Activation checklist of the org (PL-15). Read again at every visit: properties, payments and bookings change it from
 * other screens and from Stripe, and no mutation of this app invalidates it.
 */
export function useOnboardingStatus(enabled = true) {
  return useQuery({
    queryKey: ONBOARDING_STATUS_KEY,
    queryFn: () => onboardingApi.getStatus(),
    enabled,
    refetchOnMount: 'always',
  });
}
