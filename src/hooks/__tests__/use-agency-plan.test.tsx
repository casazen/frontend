import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAgencyPlan } from '../use-agency-plan';

const state = vi.hoisted(() => ({
  me: { isLoading: false },
  org: { isAgency: false, isLoading: false, isError: false, data: undefined as unknown, refetch: vi.fn() },
}));

vi.mock('@/queries/use-users', () => ({ useCurrentUser: () => state.me }));
vi.mock('@/hooks/useOrg', () => ({ useOrg: () => state.org }));

beforeEach(() => {
  state.me = { isLoading: false };
  state.org = { isAgency: false, isLoading: false, isError: false, data: undefined, refetch: vi.fn() };
});

describe('the plan of the organization, for the pages of the agency\'s money', () => {
  it('UseAgencyPlan_PersonStillOnItsWay_IsLoading_NeverNotOnThePlan', () => {
    state.me = { isLoading: true };

    const { result } = renderHook(() => useAgencyPlan());

    expect(result.current.isLoading).toBe(true);
  });

  it('UseAgencyPlan_EntitlementOnItsWay_IsLoading', () => {
    state.org = { ...state.org, isLoading: true };

    const { result } = renderHook(() => useAgencyPlan());

    expect(result.current.isLoading).toBe(true);
  });

  it.each([true, false])('UseAgencyPlan_TheEntitlementDecides_IsAgency_%s', (isAgency) => {
    state.org = { ...state.org, isAgency, data: { isAgency } };

    const { result } = renderHook(() => useAgencyPlan());

    expect(result.current).toMatchObject({ isAgency, isLoading: false, failed: false });
  });

  it('UseAgencyPlan_EntitlementFailedWithNothingInMemory_IsFailed_AndRetryReadsItAgain', () => {
    state.org = { ...state.org, isError: true };

    const { result } = renderHook(() => useAgencyPlan());
    result.current.retry();

    expect(result.current.failed).toBe(true);
    expect(state.org.refetch).toHaveBeenCalledTimes(1);
  });

  it('UseAgencyPlan_AnUpdateFailedButTheOlderAnswerIsThere_IsNotFailed', () => {
    state.org = { ...state.org, isAgency: true, isError: true, data: { isAgency: true } };

    const { result } = renderHook(() => useAgencyPlan());

    expect(result.current).toMatchObject({ isAgency: true, failed: false });
  });
});
