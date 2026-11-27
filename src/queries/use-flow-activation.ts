import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { onboardingApi } from '@/api/onboarding.api';
import type { FlowActivationOutcome, OnboardingFlowKey, OnboardingPrerequisiteKey } from '@/types/onboarding.types';
import { ONBOARDING_FLOWS_KEY } from './use-onboarding-flows';
import { invalidateOnboarding } from './use-onboarding-plan';

/**
 * What a flow that was switched on or off touches (E10/F03/US02/T03, NF-106): the status with its counts, the plan and the path (the part «Riepilogo e
 * attivazione» and what hangs from it), the lists of the properties of every flow and the «Da fare» list, where the server keeps what is not ready.
 */
function invalidateAfterActivation(queryClient: QueryClient): void {
  invalidateOnboarding(queryClient);
  void queryClient.invalidateQueries({ queryKey: ONBOARDING_FLOWS_KEY });
}

interface FlowSelection {
  flow: OnboardingFlowKey;
  /** 1 to 500 properties: an empty list is a 422 and never «all». */
  propertyIds: string[];
}

/**
 * Switches a flow on for the properties named (`POST /onboarding/flows/{flow}/activate`): the server checks the prerequisites of each one again and
 * answers one outcome per property, so a property that is not ready stays as it is and is told why. Organization administrator only (403 to anyone
 * else): the screen offers it to nobody else. The lists are read again also after a refusal: the server may have moved on.
 */
export function useActivateFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ flow, propertyIds }: FlowSelection) => onboardingApi.activateFlow(flow, propertyIds),
    onSettled: () => invalidateAfterActivation(queryClient),
  });
}

/** Switches a flow off on the properties where it runs (`POST /onboarding/flows/{flow}/deactivate`): the row stays, with when and who. Organization administrator only. */
export function useDeactivateFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ flow, propertyIds }: FlowSelection) => onboardingApi.deactivateFlow(flow, propertyIds),
    onSettled: () => invalidateAfterActivation(queryClient),
  });
}

/**
 * The final test (`POST /onboarding/test-run`): a recently imported booking of the property passes through every flow and nothing is written or sent,
 * so nothing is read again after it. Without a booking the server takes the most recent one of the property that came from the channel manager. 404
 * `test_booking_not_found` while there is none yet, `onboarding_property_not_found`. Organization administrator only. The answer is not kept (`gcTime: 0`).
 */
export function useRunTest() {
  return useMutation({
    mutationFn: ({ propertyId, bookingId }: { propertyId: string; bookingId?: string }) => onboardingApi.runTest(propertyId, bookingId),
    gcTime: 0,
  });
}

/** How many properties each flow can be switched on for right now, and how many are not ready (`GET /onboarding/bulk/progress`, the counts of the dialog). */
export function useActivationReadiness(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...ONBOARDING_FLOWS_KEY, 'readiness'],
    queryFn: () => onboardingApi.bulkProgress(),
    select: (progress) => progress.flows,
    enabled: options?.enabled ?? true,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

/** The page size of the lists the activation reads (the most the server gives) and the most properties one call may name. */
const LIST_PAGE_SIZE = 100;
const MAX_PER_CALL = 500;

/** A property a flow was not switched on for, with the prerequisite it still lacks. */
export interface NotActivated {
  propertyId: string;
  name: string;
  unmet: OnboardingPrerequisiteKey[];
}

/** What the activation did for one flow: how many properties it switched on, the ones it did not and, if it stopped half way, what stopped it. */
export interface FlowActivationSummary {
  flow: OnboardingFlowKey;
  activated: number;
  alreadyActive: number;
  notActivated: NotActivated[];
  /** What stopped the flow (the network, the server): `null` when it went through. What it switched on before that stays on, and is counted above. */
  failure: unknown;
}

/** The properties whose flow has every prerequisite and waits only for the activation (`flow_not_activated`), by name, whatever the number of pages. */
async function readyProperties(flow: OnboardingFlowKey): Promise<Array<{ propertyId: string; name: string }>> {
  const ready: Array<{ propertyId: string; name: string }> = [];
  for (let page = 1; ; page += 1) {
    const answer = await onboardingApi.getFlowProperties(flow, { state: 'toComplete', page, pageSize: LIST_PAGE_SIZE });
    ready.push(...answer.items.filter((item) => item.reason === 'flow_not_activated').map((item) => ({ propertyId: item.propertyId, name: item.name })));
    if (page * LIST_PAGE_SIZE >= answer.totalCount || answer.items.length === 0) return ready;
  }
}

/**
 * Switches on the flows the host ticked, for the properties that are ready (E10/F03/US02/T03, NF-104 part 11): for each flow it reads the properties that
 * wait only for the activation and names them to the server in calls of at most 500; the server checks the prerequisites of each one again, so a
 * property that is not ready (any more) stays as it is and comes back in `notActivated` with what it lacks. A flow with nothing ready is not called.
 * A flow that fails does not stop the others and does not hide what was switched on: its summary carries what stopped it (`failure`) with the properties
 * done before. What is not ready is kept in «Da fare» by the server. Organization administrator only.
 */
export function useActivateReady() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (flows: readonly OnboardingFlowKey[]): Promise<FlowActivationSummary[]> => {
      const summaries: FlowActivationSummary[] = [];
      for (const flow of flows) {
        const outcomes: FlowActivationOutcome[] = [];
        let names = new Map<string, string>();
        let failure: unknown = null;
        try {
          const ready = await readyProperties(flow);
          names = new Map(ready.map((property) => [property.propertyId, property.name]));
          for (let start = 0; start < ready.length; start += MAX_PER_CALL) {
            const chunk = ready.slice(start, start + MAX_PER_CALL).map((property) => property.propertyId);
            outcomes.push(...(await onboardingApi.activateFlow(flow, chunk)).outcomes);
          }
        } catch (error) {
          // A flow that stops does not take the others with it, and what it (and the flows before it) switched on stays on: the result says both,
          // flow by flow, instead of an error that hides what was done.
          failure = error;
        }
        summaries.push({
          flow,
          activated: outcomes.filter((outcome) => outcome.outcome === 'activated').length,
          alreadyActive: outcomes.filter((outcome) => outcome.outcome === 'alreadyActive').length,
          notActivated: outcomes
            .filter((outcome) => outcome.outcome !== 'activated' && outcome.outcome !== 'alreadyActive')
            .map((outcome) => ({ propertyId: outcome.propertyId, name: names.get(outcome.propertyId) ?? outcome.propertyId, unmet: outcome.unmetPrerequisites ?? [] })),
          failure,
        });
      }
      return summaries;
    },
    gcTime: 0,
    onSettled: () => invalidateAfterActivation(queryClient),
  });
}
