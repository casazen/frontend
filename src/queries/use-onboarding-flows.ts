import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { onboardingApi } from '@/api/onboarding.api';
import { ONBOARDING_FLOW_KEYS, type FlowPropertiesQuery, type OnboardingFlowKey } from '@/types/onboarding.types';
import { ONBOARDING_STATUS_KEY } from './use-onboarding-status';

/** The lists of the properties of each flow (`GET /onboarding/flows/{flow}/properties`, NF-106): what a change of a flow invalidates. */
export const ONBOARDING_FLOWS_KEY = ['onboarding', 'flows'] as const;

/**
 * The six flows over the properties the caller reaches, with how many properties are active, to complete and not available in each (`flows` of
 * `GET /onboarding/status`, NF-106). It is the activation checklist read through its own members: the same query, so a change one screen makes is
 * seen by the other. Derived by the server on every read from what other screens change, so it is read again at every visit.
 */
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

/**
 * The same page of properties (same page, size and search) for each of the six flows, one read each, in the order of `ONBOARDING_FLOW_KEYS`: the table of
 * the summary puts the flows side by side. Every flow lists every property the caller reaches, by name, so the same page holds the same properties in
 * each. The reads share their keys with `useFlowProperties`, so a list that is already on screen is not asked again.
 */
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
