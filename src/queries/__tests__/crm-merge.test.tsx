import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type AxiosResponse } from 'axios';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { CrmMergeApi } from '@/api/crm-merge.api';
import { CRM_GUESTS_KEY, crmGuestKey } from '@/queries/crm';
import { MERGE_CANDIDATES_KEY, useDismissMergeCandidate, useMergeProfiles } from '../crm-merge';

vi.mock('@/api/crm-merge.api', () => ({
  CrmMergeApi: { getCandidates: vi.fn(), dismiss: vi.fn(), merge: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const GONE = '11111111-1111-4111-8111-111111111111';
const KEPT = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const CANDIDATE = 'c1c1c1c1-0000-4000-8000-000000000001';
const LIST_KEY = [...CRM_GUESTS_KEY, { page: 1, pageSize: 20 }] as const;
const PROPOSALS_KEY = [...MERGE_CANDIDATES_KEY, 1] as const;

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

/** What the app has read before the host decides: the list, the page of each of the two profiles, another profile and the proposals. */
function seedWhatTheAppHasRead() {
  client.setQueryData(LIST_KEY, { items: [], totalCount: 0, page: 1, pageSize: 20 });
  client.setQueryData(crmGuestKey(GONE), { id: GONE });
  client.setQueryData(crmGuestKey(KEPT), { id: KEPT });
  client.setQueryData(crmGuestKey(OTHER), { id: OTHER });
  client.setQueryData(PROPOSALS_KEY, { items: [], totalCount: 0, page: 1, pageSize: 20 });
}

const stale = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated;

function problem(status: number, code: string): AxiosError {
  const response = { status, statusText: String(status), data: { code }, headers: {}, config: {} } as unknown as AxiosResponse;
  return new AxiosError(code, String(status), undefined, undefined, response);
}

describe('useMergeProfiles: what a merge leaves behind in what the app has read (E07/F01/US04/T03)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    seedWhatTheAppHasRead();
    vi.mocked(CrmMergeApi.merge).mockResolvedValue({} as never);
  });
  afterEach(() => client.clear());

  it('useMergeProfiles_Merged_DropsThePageOfTheProfileThatWentAndReadsTheListTheProfilesAndTheProposalsAgain', async () => {
    const { result } = renderHook(() => useMergeProfiles(), { wrapper });

    await act(() => result.current.mutateAsync({ candidateId: CANDIDATE, survivorProfileId: KEPT, discardedProfileId: GONE }));

    expect(CrmMergeApi.merge).toHaveBeenCalledWith(CANDIDATE, KEPT);
    // The profile that went is a tombstone: what was read of it is not kept, so its page cannot come back from the cache.
    expect(client.getQueryData(crmGuestKey(GONE))).toBeUndefined();
    // The list, the page of the profile that stays (it has the other's stays and contacts), any other page and the proposals are read again.
    expect(stale(LIST_KEY)).toBe(true);
    expect(stale(crmGuestKey(KEPT))).toBe(true);
    expect(stale(crmGuestKey(OTHER))).toBe(true);
    expect(stale(PROPOSALS_KEY)).toBe(true);
    expect(toast.success).toHaveBeenCalledWith(i18n.t('crm.merge.mergeDone'));
  });

  it('useMergeProfiles_TheServerRefuses_ClaimsNothingKeepsWhatWasReadAndReadsTheProposalsAgain', async () => {
    vi.mocked(CrmMergeApi.merge).mockRejectedValue(problem(409, 'crm_merge_not_proposed'));
    const { result } = renderHook(() => useMergeProfiles(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ candidateId: CANDIDATE, survivorProfileId: KEPT, discardedProfileId: GONE })).rejects.toThrow();
    });

    expect(toast.error).toHaveBeenCalledWith(i18n.t('apiErrors.codes.crmMergeNotProposed'));
    expect(toast.success).not.toHaveBeenCalled();
    // Nothing was merged: the profile is still there, and the list and the profiles are as they were.
    expect(client.getQueryData(crmGuestKey(GONE))).toEqual({ id: GONE });
    expect(stale(LIST_KEY)).toBe(false);
    expect(stale(crmGuestKey(KEPT))).toBe(false);
    // The proposal may be decided or out of reach: the proposals are read again.
    expect(stale(PROPOSALS_KEY)).toBe(true);
  });
});

describe('useDismissMergeCandidate: what saying "not the same person" leaves behind (E07/F01/US04/T03)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    seedWhatTheAppHasRead();
    vi.mocked(CrmMergeApi.dismiss).mockResolvedValue(undefined);
  });
  afterEach(() => client.clear());

  it('useDismissMergeCandidate_Dismissed_KeepsTheProfilesAndReadsTheMarkOfTheListTheCountOfThePagesAndTheProposalsAgain', async () => {
    const { result } = renderHook(() => useDismissMergeCandidate(), { wrapper });

    await act(() => result.current.mutateAsync(CANDIDATE));

    expect(CrmMergeApi.dismiss).toHaveBeenCalledWith(CANDIDATE);
    // Both profiles are still there: only the mark "possible duplicate" of the list and the count of their pages change.
    expect(client.getQueryData(crmGuestKey(GONE))).toEqual({ id: GONE });
    expect(client.getQueryData(crmGuestKey(KEPT))).toEqual({ id: KEPT });
    expect(stale(LIST_KEY)).toBe(true);
    expect(stale(crmGuestKey(GONE))).toBe(true);
    expect(stale(crmGuestKey(KEPT))).toBe(true);
    expect(stale(PROPOSALS_KEY)).toBe(true);
    expect(toast.success).toHaveBeenCalledWith(i18n.t('crm.merge.dismissDone'));
  });

  it('useDismissMergeCandidate_TheServerRefuses_ClaimsNothingAndReadsTheProposalsAgain', async () => {
    vi.mocked(CrmMergeApi.dismiss).mockRejectedValue(problem(404, 'crm_merge_candidate_not_found'));
    const { result } = renderHook(() => useDismissMergeCandidate(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(CANDIDATE)).rejects.toThrow();
    });

    expect(toast.error).toHaveBeenCalledWith(i18n.t('apiErrors.codes.crmMergeCandidateNotFound'));
    expect(toast.success).not.toHaveBeenCalled();
    expect(stale(LIST_KEY)).toBe(false);
    expect(stale(PROPOSALS_KEY)).toBe(true);
  });
});
