import { useCommercialProfile } from '@/hooks/use-commercial-profile';
import { commercialPartAllowed } from '@/features/onboarding/commercial-access';
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { onboardingApi } from '@/api/onboarding.api';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { isPathIncomplete, knownPathSteps, nextPathStep, pathProgress } from '@/lib/onboarding-parts';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import type { OnboardingPart, OnboardingPathStep } from '@/types/onboarding.types';
import { ONBOARDING_PATH_KEY, invalidateOnboarding } from './use-onboarding-plan';

export function useOnboardingPath(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ONBOARDING_PATH_KEY,
    queryFn: () => onboardingApi.getPath(),
    enabled: options?.enabled ?? true,
    refetchOnMount: 'always',
  });
}

/**
 * Whether the path is shown to this person at all: the flag `octorateOnboarding` is on and they are an organization administrator, because
 * putting a step off («Più tardi») is the administrator's decision (the server answers 403 to anyone else) and the path is theirs to walk.
 */
export function useOnboardingPathEnabled(): boolean {
  const { flags } = useFeatureFlags();
  const { contexts } = useWorkspace();
  const commercial = useCommercialProfile();
  return flags.octorateOnboarding && isOrgBillingAdmin(contexts) && (!commercial?.commercialSignup || commercial.commercialEnabledAddons?.includes('channels') === true);
}

export interface VisibleOnboardingPath {
  steps: OnboardingPathStep[];
  next: OnboardingPathStep | null;
  done: number;
  total: number;
}

export function useVisibleOnboardingPath(options?: { enabled?: boolean }): { path: VisibleOnboardingPath | null; pending: boolean } {
  const enabled = useOnboardingPathEnabled() && (options?.enabled ?? true);
  const query = useOnboardingPath({ enabled });
  const commercial = useCommercialProfile();

  return useMemo(() => {
    if (!enabled) return { path: null, pending: false };
    const steps = knownPathSteps(query.data).map(step => ({ ...step, parts: step.parts.filter(part => commercialPartAllowed(commercial, part)) })).filter(step => step.parts.length > 0);
    if (steps.length === 0 || !isPathIncomplete(steps)) return { path: null, pending: query.isPending };
    return { path: { steps, next: nextPathStep(query.data, steps) ?? (query.data?.next ? steps.find(step => step.visible && step.state === 'open') ?? null : null), ...pathProgress(steps) }, pending: false };
  }, [enabled, query.data, query.isPending, commercial]);
}

export function useDeferNextStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (part: Pick<OnboardingPart, 'code' | 'deferrable'>) =>
      part.deferrable === false ? onboardingApi.exitPart(part.code) : onboardingApi.deferPart(part.code),
    onSuccess: () => invalidateOnboarding(queryClient),
  });
}
