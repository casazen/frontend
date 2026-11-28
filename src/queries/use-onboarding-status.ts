import { useQuery } from '@tanstack/react-query';
import { onboardingApi } from '@/api/onboarding.api';

export const ONBOARDING_STATUS_KEY = ['onboarding', 'status'] as const;

export function useOnboardingStatus(enabled = true) {
  return useQuery({
    queryKey: ONBOARDING_STATUS_KEY,
    queryFn: () => onboardingApi.getStatus(),
    enabled,
    refetchOnMount: 'always',
  });
}
