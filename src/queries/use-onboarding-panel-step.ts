import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { onboardingApi } from '@/api/onboarding.api';
import { nextPollDelayMs } from '@/lib/onboarding-panel';
import type { PanelStep, StartedPanelStep, StartPanelStepRequest } from '@/types/onboarding.types';
import { invalidateOnboarding } from './use-onboarding-plan';

/** The guided steps of the panel of the channel manager (`/onboarding/panel-steps`, NF-107): the list of the org and the stored state of each. */
export const PANEL_STEPS_KEY = ['onboarding', 'panel-steps'] as const;
const PANEL_STEPS_LIST_KEY = [...PANEL_STEPS_KEY, 'list'] as const;
const panelStepKey = (id: string) => [...PANEL_STEPS_KEY, 'step', id] as const;

/**
 * What a step that moved on (verified, confirmed, handed to support) touches: the plan, the path and the activation checklist, the lists of the
 * six flows (a connection that works turns a property from «to complete» to ready), the connection and the import of the listings, and the
 * «Da fare» list, where the step had its item. Only the screens that show them ask the server again; the others read on their next visit.
 */
export function invalidateAfterPanelStep(queryClient: QueryClient): void {
  invalidateOnboarding(queryClient);
  // The list, not the step a page follows: that one is kept as the server answered (`remember`) and is read at its own pace.
  void queryClient.invalidateQueries({ queryKey: PANEL_STEPS_LIST_KEY });
  void queryClient.invalidateQueries({ queryKey: ['onboarding', 'flows'] });
  void queryClient.invalidateQueries({ queryKey: ['octorate'] });
}

/** The state of a step as the server answers a read, a check or a confirmation: the cache of the page that follows it. */
function remember(queryClient: QueryClient, step: PanelStep): void {
  queryClient.setQueryData(panelStepKey(step.id), step);
}

/** The step without what only the start returns: the address of the panel is single-use and never goes in the cache. */
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
    // The step the page holds is not read again at once: the server asked for the first check to wait.
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
      // The list and the «Da fare» list: the step has its item from the moment it is stored.
      invalidateAfterPanelStep(queryClient);
    },
  });
}

/**
 * The explicit trigger of a check: the window of the panel was closed, or the tab got the focus again. The server holds it to a minimum gap
 * from the previous one and answers the stored state when it is too early, so a page that triggers it often is harmless. A step that comes back
 * done moves the rest of the app on.
 */
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

/**
 * The person says the step is done, which the server accepts only after a real check found that CasaZen cannot tell. 409
 * `panel_step_verification_required`, `panel_step_not_valid`, `panel_step_assist_open`: the screen says which.
 */
export function useConfirmPanelStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => onboardingApi.confirmPanelStep(id),
    onSuccess: (step) => {
      remember(queryClient, step);
      invalidateAfterPanelStep(queryClient);
    },
    // A refusal says the state moved on (a check ran, support took it): read it again.
    onError: () => void queryClient.invalidateQueries({ queryKey: PANEL_STEPS_LIST_KEY }),
  });
}

/**
 * The end of a panel that sends the person back (`redirectCallback`): the `state` of the address is used once, in the body (it never stays in the
 * address or the history), and the step is verified. The answer is not kept (`gcTime: 0`). 422 `panel_step_state_invalid`.
 */
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
