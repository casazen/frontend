import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { onboardingApi } from '@/api/onboarding.api';
import type { CreateAssistRequest } from '@/types/onboarding.types';
import { invalidateOnboarding } from './use-onboarding-plan';
import { PANEL_STEPS_KEY } from './use-onboarding-panel-step';

/** The «Fallo per me» requests of the org (`/onboarding/assist-requests`, UX-15). */
export const ASSIST_REQUESTS_KEY = ['onboarding', 'assist-requests'] as const;

/**
 * The «Fallo per me» requests of the org the caller reaches. CasaZen support changes them (takes one, closes it), so they are read again at every
 * visit and nothing here keeps a request «open». Organization administrator only: a page that is not for anyone else passes `enabled: false`.
 */
export function useAssistRequests(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ASSIST_REQUESTS_KEY,
    queryFn: () => onboardingApi.listAssistRequests(),
    enabled: options?.enabled ?? true,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

/**
 * «Fallo per me»: asks CasaZen support to do a step. The request gets its «Da fare» and the step moves to support, so the plan, the path, the
 * list of the guided steps and the «Da fare» list are read again, also after a refusal (409 `assist_request_already_open`: the request that is
 * open is the answer, read from the list; `assist_step_already_done`). Errors are not toasted: the screen says them where the person looks.
 */
export function useRequestAssist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateAssistRequest) => onboardingApi.requestAssist(request),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ASSIST_REQUESTS_KEY });
      void queryClient.invalidateQueries({ queryKey: PANEL_STEPS_KEY });
      invalidateOnboarding(queryClient);
    },
  });
}
