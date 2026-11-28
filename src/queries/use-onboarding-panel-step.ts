import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { onboardingApi } from '@/api/onboarding.api';
import { nextPollDelayMs } from '@/lib/onboarding-panel';
import type { PanelStep, StartedPanelStep, StartPanelStepRequest } from '@/types/onboarding.types';
import { invalidateOnboarding } from './use-onboarding-plan';

export const PANEL_STEPS_KEY = ['onboarding', 'panel-steps'] as const;
const PANEL_STEPS_LIST_KEY = [...PANEL_STEPS_KEY, 'list'] as const;
const panelStepKey = (id: string) => [...PANEL_STEPS_KEY, 'step', id] as const;

function invalidateAfterPanelStep(queryClient: QueryClient): void {
  invalidateOnboarding(queryClient);
  void queryClient.invalidateQueries({ queryKey: PANEL_STEPS_LIST_KEY });
  void queryClient.invalidateQueries({ queryKey: ['onboarding', 'flows'] });
  void queryClient.invalidateQueries({ queryKey: ['octorate'] });
}

function remember(queryClient: QueryClient, step: PanelStep): void {
  queryClient.setQueryData(panelStepKey(step.id), step);
}

function withoutAddresses(started: StartedPanelStep): PanelStep {
  const step: Partial<StartedPanelStep> = { ...started };
  delete step.panelUrl;
  delete step.callbackUrl;
  return step as PanelStep;
}

/**
 * The guided steps of the org the caller reaches, the most recently started first; `propertyId` keeps the ones of that property (the list is
 * one read, the filter is the page's). Read again at every visit: a step moves on by itself (a check) and by support, and a page that comes
 * back to it (the To do) must show where it stands now. Organization administrator only (a 403 is for anyone else).
 */
export function usePanelSteps(propertyId?: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: PANEL_STEPS_LIST_KEY,
    queryFn: () => onboardingApi.listPanelSteps(),
    select: (steps) => (propertyId === undefined ? steps : steps.filter((step) => (step.propertyId ?? null) === (propertyId ?? null))),
    enabled: options?.enabled ?? true,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

/**
 * The stored state of one step, read at the pace the server asks for: `nextCheckAt` says when its next check is due and reading the step runs
 * that check, so the page follows it (never faster than a few seconds, and not while the tab is hidden). It stops once the step is done, handed
 * to support or not open any more. `initialData` is the step the page already holds (the start, the list): the first read waits for its schedule.
 */
export function usePanelStepStatus(id: string | undefined, options?: { enabled?: boolean; initialData?: PanelStep }) {
  return useQuery({
    queryKey: panelStepKey(id ?? ''),
    queryFn: () => onboardingApi.getPanelStepStatus(id ?? ''),
    enabled: Boolean(id) && (options?.enabled ?? true),
    initialData: options?.initialData,
    staleTime: 0,
    refetchInterval: (query) => nextPollDelayMs(query.state.data, Date.now()),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnMount: options?.initialData ? false : 'always',
  });
}

/**
 * Starts the step (`POST /onboarding/panel-steps`; starting it again is harmless): the answer holds the stored state, the address of the panel and,
 * for `redirectCallback`, the page the panel sends the person back to. The caller opens the panel only after this answer, because the step and
 * the point to come back to are stored before it. The answer is not kept once nobody watches it (`gcTime: 0`). 409 `octorate_panel_url_missing`;
 * 422 `panel_step_kind_invalid`, `panel_step_channel_invalid`, `panel_step_resume_invalid`. Errors are not toasted: the screen says them.
 */
export function useStartPanelStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: StartPanelStepRequest) => onboardingApi.startPanelStep(request),
    gcTime: 0,
    onSuccess: (started) => {
      remember(queryClient, withoutAddresses(started));
      invalidateAfterPanelStep(queryClient);
    },
  });
}

export function useVerifyPanelStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => onboardingApi.verifyPanelStep(id),
    onSuccess: (step) => {
      remember(queryClient, step);
      if (step.status === 'verified' || step.status === 'confirmed') invalidateAfterPanelStep(queryClient);
    },
  });
}

export function useConfirmPanelStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => onboardingApi.confirmPanelStep(id),
    onSuccess: (step) => {
      remember(queryClient, step);
      invalidateAfterPanelStep(queryClient);
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: PANEL_STEPS_LIST_KEY }),
  });
}

export function useCompletePanelStepCallback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) => onboardingApi.completePanelStepCallback(id, state),
    gcTime: 0,
    onSuccess: (step) => {
      remember(queryClient, step);
      invalidateAfterPanelStep(queryClient);
    },
  });
}
