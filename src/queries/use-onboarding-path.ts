import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { onboardingApi } from '@/api/onboarding.api';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { isPathIncomplete, knownPathSteps, nextPathStep, pathProgress } from '@/lib/onboarding-parts';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import type { OnboardingPart, OnboardingPathStep } from '@/types/onboarding.types';
import { ONBOARDING_PATH_KEY, invalidateOnboarding } from './use-onboarding-plan';

/**
 * The connected path «Inizia con CasaZen» (UX-10, `GET /onboarding/path`): its six steps, which are visible, and the next one. Other screens
 * change what is done, so it is read again at every visit. Answers 404 while the backend flag `OctorateOnboarding` is off: a screen that may
 * show up with the flag off passes `enabled: false`.
 */
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
  return flags.octorateOnboarding && isOrgBillingAdmin(contexts);
}

/** What the home shows of the path while it is incomplete. */
export interface VisibleOnboardingPath {
  /** The steps this version knows, in order. */
  steps: OnboardingPathStep[];
  /** The step to do next; null when the host put off every step that is left. */
  next: OnboardingPathStep | null;
  /** The steps that are done and the steps that apply. */
  done: number;
  total: number;
}

/**
 * The path as the host home shows it (the card of the path, UX-10): the steps with how far the host is, only while the path is incomplete.
 * Nothing (`path` null) while the flag is off, for someone who is not an organization administrator, while it loads, when it cannot be
 * read and once it is complete; `pending` is true only while it loads for someone who is shown it, so the home does not flash another card first.
 */
export function useVisibleOnboardingPath(options?: { enabled?: boolean }): { path: VisibleOnboardingPath | null; pending: boolean } {
  // A screen that has no use for the path now (the guide while it is closed, a welcome already seen) asks nothing of the server.
  const enabled = useOnboardingPathEnabled() && (options?.enabled ?? true);
  const query = useOnboardingPath({ enabled });

  return useMemo(() => {
    if (!enabled) return { path: null, pending: false };
    const steps = knownPathSteps(query.data);
    if (steps.length === 0 || !isPathIncomplete(steps)) return { path: null, pending: query.isPending };
    return { path: { steps, next: nextPathStep(query.data, steps), ...pathProgress(steps) }, pending: false };
  }, [enabled, query.data, query.isPending]);
}

/**
 * «Più tardi» on the step suggested at the end of a wizard: the part of the step is put off to «Da fare» (`deferPart`, reminder tomorrow at 09:00
 * in Rome), or, when another part needs it (it cannot be deferred), left with `exitPart`, which keeps it open and leaves the same «Da fare».
 * An organization administrator's action. The path, the plan, the checklist and the «Da fare» list are read again afterwards.
 */
export function useDeferNextStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (part: Pick<OnboardingPart, 'code' | 'deferrable'>) =>
      part.deferrable === false ? onboardingApi.exitPart(part.code) : onboardingApi.deferPart(part.code),
    onSuccess: () => invalidateOnboarding(queryClient),
  });
}
