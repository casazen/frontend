import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { onboardingApi } from '@/api/onboarding.api';
import type { FlowActivationOutcome, OnboardingFlowKey, OnboardingPrerequisiteKey } from '@/types/onboarding.types';
import { ONBOARDING_FLOWS_KEY } from './use-onboarding-flows';
import { invalidateOnboarding } from './use-onboarding-plan';

function invalidateAfterActivation(queryClient: QueryClient): void {
  invalidateOnboarding(queryClient);
  void queryClient.invalidateQueries({ queryKey: ONBOARDING_FLOWS_KEY });
}

export function useRunTest() {
  return useMutation({
    mutationFn: ({ propertyId, bookingId }: { propertyId: string; bookingId?: string }) => onboardingApi.runTest(propertyId, bookingId),
    gcTime: 0,
  });
}

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

const LIST_PAGE_SIZE = 100;
const MAX_PER_CALL = 500;

interface NotActivated {
  propertyId: string;
  name: string;
  unmet: OnboardingPrerequisiteKey[];
}

export interface FlowActivationSummary {
  flow: OnboardingFlowKey;
  activated: number;
  alreadyActive: number;
  notActivated: NotActivated[];
  failure: unknown;
}

async function readyProperties(flow: OnboardingFlowKey): Promise<Array<{ propertyId: string; name: string }>> {
  const ready: Array<{ propertyId: string; name: string }> = [];
  for (let page = 1; ; page += 1) {
    const answer = await onboardingApi.getFlowProperties(flow, { state: 'toComplete', page, pageSize: LIST_PAGE_SIZE });
    ready.push(...answer.items.filter((item) => item.reason === 'flow_not_activated').map((item) => ({ propertyId: item.propertyId, name: item.name })));
    if (page * LIST_PAGE_SIZE >= answer.totalCount || answer.items.length === 0) return ready;
  }
}

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
