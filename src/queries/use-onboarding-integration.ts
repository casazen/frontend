import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { onboardingApi } from '@/api/onboarding.api';
import type { OnboardingPartKey } from '@/types/onboarding.types';
import { invalidateOnboarding } from './use-onboarding-plan';

const ONBOARDING_INTEGRATION_KEY = ['onboarding', 'integration'] as const;

/**
 * The integration settings (NF-108): the health of the connection, the plan with whether each part can be reopened, who sends the Alloggiati and ISTAT
 * communications and how the listings stand per channel. Every figure is worked out by the server on each read from what other screens change (a sender, a
 * channel, the connection), so it is read again at every visit and after a short time on screen. An organization administrator's page: the server answers 403 to
 * anyone else, so a page that anyone can open passes `enabled: false` for them and sends nothing. The answer holds codes, counts and instants, never a token.
 */
export function useOnboardingIntegration(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ONBOARDING_INTEGRATION_KEY,
    queryFn: () => onboardingApi.getIntegration(),
    enabled: options?.enabled ?? true,
    refetchOnMount: 'always',
    staleTime: 30 * 1000,
  });
}

export function useReopenPart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (key: OnboardingPartKey) => onboardingApi.reopenPart(key),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ONBOARDING_INTEGRATION_KEY });
      invalidateOnboarding(queryClient);
    },
  });
}
