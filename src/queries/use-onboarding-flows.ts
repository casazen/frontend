import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { onboardingApi } from '@/api/onboarding.api';
import { ONBOARDING_FLOW_KEYS, type FlowPropertiesQuery, type OnboardingFlowKey } from '@/types/onboarding.types';
import { ONBOARDING_STATUS_KEY } from './use-onboarding-status';

export const ONBOARDING_FLOWS_KEY = ['onboarding', 'flows'] as const;

export function useFlowSummaries(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ONBOARDING_STATUS_KEY,
    queryFn: () => onboardingApi.getStatus(),
    select: (status) => status.flows ?? [],
    enabled: options?.enabled ?? true,
    refetchOnMount: 'always',
  });
}

/**
 * The properties the caller reaches with their status for one flow, a page at a time and by name (NF-106): 250 properties never load at once. The
 * page that was on screen stays until the next one arrives, so paging and searching do not blink. Read again at every visit: the state of a flow on
 * a property is derived by the server from what other screens change. 400 `onboarding_flow_unknown` and `onboarding_flow_state_unknown` for a name
 * or a state the server does not know.
 */
export function useFlowProperties(flow: OnboardingFlowKey | undefined, params: FlowPropertiesQuery = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...ONBOARDING_FLOWS_KEY, flow ?? null, params],
    queryFn: () => onboardingApi.getFlowProperties(flow as OnboardingFlowKey, params),
    enabled: flow !== undefined && (options?.enabled ?? true),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

export function useFlowMatrix(params: Omit<FlowPropertiesQuery, 'state'>, options?: { enabled?: boolean }) {
  return useQueries({
    queries: ONBOARDING_FLOW_KEYS.map((flow) => ({
      queryKey: [...ONBOARDING_FLOWS_KEY, flow, params],
      queryFn: () => onboardingApi.getFlowProperties(flow, params),
      enabled: options?.enabled ?? true,
      placeholderData: keepPreviousData,
      refetchOnMount: 'always' as const,
      refetchOnWindowFocus: false,
    })),
  });
}
