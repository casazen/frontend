import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { onboardingApi } from '@/api/onboarding.api';
import { INTERNAL_ACTIVITIES_KEY } from '@/lib/query-client';
import type { OnboardingPartKey } from '@/types/onboarding.types';
import { ONBOARDING_STATUS_KEY } from './use-onboarding-status';

export const ONBOARDING_PLAN_KEY = ['onboarding', 'plan'] as const;
export const ONBOARDING_PATH_KEY = ['onboarding', 'path'] as const;

export function invalidateOnboarding(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ONBOARDING_PLAN_KEY });
  void queryClient.invalidateQueries({ queryKey: ONBOARDING_PATH_KEY });
  void queryClient.invalidateQueries({ queryKey: ONBOARDING_STATUS_KEY });
  void queryClient.invalidateQueries({ queryKey: [INTERNAL_ACTIVITIES_KEY] });
}

export function useOnboardingPlan(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ONBOARDING_PLAN_KEY,
    queryFn: () => onboardingApi.getPlan(),
    enabled: options?.enabled ?? true,
    refetchOnMount: 'always',
  });
}

export function useDeferPart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ key, remindAt }: { key: OnboardingPartKey; remindAt?: string }) => onboardingApi.deferPart(key, remindAt),
    onSuccess: () => invalidateOnboarding(queryClient),
  });
}

export function useExitPart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (key: OnboardingPartKey) => onboardingApi.exitPart(key),
    onSuccess: () => invalidateOnboarding(queryClient),
  });
}

export function useResumePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (key: OnboardingPartKey) => onboardingApi.resumePart(key),
    onSuccess: () => invalidateOnboarding(queryClient),
  });
}
