import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { onboardingApi } from '@/api/onboarding.api';
import { INTERNAL_ACTIVITIES_KEY } from '@/lib/query-client';
import type { OnboardingPartKey } from '@/types/onboarding.types';
import { ONBOARDING_STATUS_KEY } from './use-onboarding-status';

/** The plan of the activation (`GET /onboarding/plan`) and the connected path (`GET /onboarding/path`). */
export const ONBOARDING_PLAN_KEY = ['onboarding', 'plan'] as const;
export const ONBOARDING_PATH_KEY = ['onboarding', 'path'] as const;

/**
 * What a change of a part touches: the plan and the path that tell where it stands, the activation checklist (`ONBOARDING_STATUS_KEY`) that is
 * derived from the same facts, and the «Da fare» list, where a deferral or an exit leaves its reminder and a resume takes it away. Only the
 * screens that show them (an active query) ask the server again; the others are marked stale and read on their next visit.
 */
export function invalidateOnboarding(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ONBOARDING_PLAN_KEY });
  void queryClient.invalidateQueries({ queryKey: ONBOARDING_PATH_KEY });
  void queryClient.invalidateQueries({ queryKey: ONBOARDING_STATUS_KEY });
  void queryClient.invalidateQueries({ queryKey: [INTERNAL_ACTIVITIES_KEY] });
}

/**
 * The plan of the activation of the caller's org: the eleven parts with their state, «What you need» and the path (NF-104). Every state is
 * derived by the server on each read from what other screens change (a property, a channel, a sender), so it is read again at every
 * visit and nothing here keeps a part "done". Answers 404 while the backend flag `OctorateOnboarding` is off: the page that reads it
 * is behind the web flag, and a screen that may show up with the flag off passes `enabled: false`.
 */
export function useOnboardingPlan(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ONBOARDING_PLAN_KEY,
    queryFn: () => onboardingApi.getPlan(),
    enabled: options?.enabled ?? true,
    refetchOnMount: 'always',
  });
}

/**
 * «Lo faccio dopo»: puts a part off to `remindAt` (UTC, or tomorrow at 09:00 in Rome when it is left out) and leaves a «Da fare» for it. An
 * organization administrator's action: the server answers 403 to anyone else, so a screen offers it only to who may (the plan page asks
 * `isOrgBillingAdmin`). 422 `onboarding_part_prerequisite` for a part another part requires.
 */
export function useDeferPart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ key, remindAt }: { key: OnboardingPartKey; remindAt?: string }) => onboardingApi.deferPart(key, remindAt),
    onSuccess: () => invalidateOnboarding(queryClient),
  });
}

/** «Salva ed esci»: the part stays open and a «Da fare» keeps what remains from disappearing silently. Organization administrator only. */
export function useExitPart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (key: OnboardingPartKey) => onboardingApi.exitPart(key),
    onSuccess: () => invalidateOnboarding(queryClient),
  });
}

/** The host takes a part up again: the deferral is cleared and its «Da fare» closed. Organization administrator only. */
export function useResumePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (key: OnboardingPartKey) => onboardingApi.resumePart(key),
    onSuccess: () => invalidateOnboarding(queryClient),
  });
}
