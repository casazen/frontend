import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { onboardingApi } from '@/api/onboarding.api';
import { INTERNAL_ACTIVITIES_KEY } from '@/lib/query-client';
import type { OnboardingPartChange, OnboardingPlan } from '@/types/onboarding.types';
import { ONBOARDING_STATUS_KEY } from '../use-onboarding-status';
import { ONBOARDING_PATH_KEY, ONBOARDING_PLAN_KEY, useDeferPart, useExitPart, useOnboardingPlan, useResumePart } from '../use-onboarding-plan';

vi.mock('@/api/onboarding.api', () => ({
  onboardingApi: { getPlan: vi.fn(), deferPart: vi.fn(), exitPart: vi.fn(), resumePart: vi.fn(), getStatus: vi.fn(), getPath: vi.fn() },
}));

const PLAN: OnboardingPlan = { parts: [], needs: [], path: { code: 'start-with-casazen', steps: [], next: null }, activated: false };
const CHANGE: OnboardingPartChange = { code: 'identification', state: 'deferred', remindAt: '2026-11-13T08:00:00Z', todoId: 'todo-1' };
const TODO_KEY = [INTERNAL_ACTIVITIES_KEY, 'todo'] as const;

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

/** Every query a change of a part touches, read once and so fresh. */
function seedFreshQueries() {
  for (const key of [ONBOARDING_PLAN_KEY, ONBOARDING_PATH_KEY, ONBOARDING_STATUS_KEY, TODO_KEY]) queryClient.setQueryData(key, { seeded: true });
}

const isStale = (key: readonly unknown[]) => queryClient.getQueryState(key)?.isInvalidated === true;

describe('the hooks of the plan of the activation (E10/F03/US01/T02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.mocked(onboardingApi.getPlan).mockResolvedValue(PLAN);
  });

  it('UseOnboardingPlan_ReadsThePlanAgainAtEveryVisitBecauseOtherScreensChangeWhatIsDone', async () => {
    queryClient.setQueryData(ONBOARDING_PLAN_KEY, PLAN);

    const { result } = renderHook(() => useOnboardingPlan(), { wrapper });

    // Fresh data in the cache does not stop the read: `refetchOnMount: 'always'`.
    await waitFor(() => expect(onboardingApi.getPlan).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.data).toEqual(PLAN);
  });

  it('UseOnboardingPlan_Disabled_NeverAsksTheServer', async () => {
    renderHook(() => useOnboardingPlan({ enabled: false }), { wrapper });

    await Promise.resolve();

    expect(onboardingApi.getPlan).not.toHaveBeenCalled();
  });

  it.each([
    ['defer', () => useDeferPart(), () => vi.mocked(onboardingApi.deferPart).mockResolvedValue(CHANGE)],
    ['exit', () => useExitPart(), () => vi.mocked(onboardingApi.exitPart).mockResolvedValue({ ...CHANGE, state: 'open' })],
    ['resume', () => useResumePart(), () => vi.mocked(onboardingApi.resumePart).mockResolvedValue({ ...CHANGE, state: 'open', remindAt: null, todoId: null })],
  ])('Mutation_%s_InvalidatesThePlanThePathTheChecklistAndTheTodoList', async (name, useMutationHook, mockApi) => {
    mockApi();
    seedFreshQueries();
    const { result } = renderHook(() => useMutationHook(), { wrapper });
    const variables = name === 'defer' ? { key: 'identification', remindAt: '2026-11-13T08:00:00.000Z' } : 'identification';

    await act(() => (result.current.mutateAsync as (value: unknown) => Promise<unknown>)(variables));

    expect(isStale(ONBOARDING_PLAN_KEY)).toBe(true);
    expect(isStale(ONBOARDING_PATH_KEY)).toBe(true);
    expect(isStale(ONBOARDING_STATUS_KEY)).toBe(true);
    expect(isStale(TODO_KEY)).toBe(true);
  });

  it('Mutation_ThatFails_LeavesWhatIsOnScreenAsItWas', async () => {
    vi.mocked(onboardingApi.deferPart).mockRejectedValue(new Error('refused'));
    seedFreshQueries();
    const { result } = renderHook(() => useDeferPart(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ key: 'properties' }).catch(() => undefined);
    });

    expect(isStale(ONBOARDING_PLAN_KEY)).toBe(false);
    expect(isStale(ONBOARDING_PATH_KEY)).toBe(false);
    expect(isStale(ONBOARDING_STATUS_KEY)).toBe(false);
  });

  it('DeferPart_SendsTheKeyAndTheMomentToTheApi', async () => {
    vi.mocked(onboardingApi.deferPart).mockResolvedValue(CHANGE);
    const { result } = renderHook(() => useDeferPart(), { wrapper });

    await act(() => result.current.mutateAsync({ key: 'identification', remindAt: '2026-11-13T08:00:00.000Z' }));

    expect(onboardingApi.deferPart).toHaveBeenCalledWith('identification', '2026-11-13T08:00:00.000Z');
  });
});
