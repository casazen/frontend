import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { CrmApi } from '@/api/crm.api';
import { queryClient as appQueryClient } from '@/lib/query-client';
import type { CrmProfileDetail } from '@/types/crm.types';
import { CRM_GUESTS_KEY, useCrmOverview, useGuestCrmProfile, useGuestCrmProfiles } from '../crm';

vi.mock('@/api/crm.api', () => ({
  CrmApi: { getGuests: vi.fn(), getGuest: vi.fn(), setTags: vi.fn(), sendConfirmation: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const PROFILE = '0b8f5d6e-1111-4a22-8333-aaaaaaaaaaa1';

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

describe('the CRM profiles are read again on every visit, with the options of the real query client (E07/F01/US04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The options of the app (a read stays fresh for minutes and nothing is read again on mount), not the ones a test usually picks.
    client = new QueryClient({ defaultOptions: appQueryClient.getDefaultOptions() });
    vi.mocked(CrmApi.getGuests).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 20 });
    vi.mocked(CrmApi.getGuest).mockResolvedValue({ id: PROFILE } as CrmProfileDetail);
  });
  afterEach(() => client.clear());

  it('theRealClient_KeepsAReadFreshForMinutes_SoOnlyAnExplicitRefetchOnMountReadsAgain', () => {
    // The premise of the proofs below: with a fresh time of zero they would pass without the option.
    expect(appQueryClient.getDefaultOptions().queries?.staleTime).toBeGreaterThanOrEqual(60_000);
    expect(appQueryClient.getDefaultOptions().queries?.refetchOnMount).toBe(false);
  });

  it('useGuestCrmProfiles_AVisitRightAfterAnother_ReadsTheListAgain', async () => {
    // A consent withdrawn (or a guest erased) in the privacy tab of the guest record does not touch the list: the next visit must read it.
    const first = renderHook(() => useGuestCrmProfiles({ page: 1, pageSize: 20 }), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();

    const second = renderHook(() => useGuestCrmProfiles({ page: 1, pageSize: 20 }), { wrapper });

    await waitFor(() => expect(CrmApi.getGuests).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(second.result.current.isFetching).toBe(false));
  });

  it('useGuestCrmProfile_AVisitRightAfterAnother_ReadsTheProfileAgain', async () => {
    const first = renderHook(() => useGuestCrmProfile(PROFILE), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();

    const second = renderHook(() => useGuestCrmProfile(PROFILE), { wrapper });

    await waitFor(() => expect(CrmApi.getGuest).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(second.result.current.isFetching).toBe(false));
  });

  it('useCrmOverview_AsksFourListsOfOneRow_AndReadsTheirTotals', async () => {
    vi.mocked(CrmApi.getGuests).mockImplementation(async (params) => {
      const totalCount = params?.minStays === 3 ? 6 : params?.minStays === 2 ? 14 : params?.reachableByEmail ? 25 : 40;
      return { items: [], totalCount, page: 1, pageSize: 1 };
    });

    const { result } = renderHook(() => useCrmOverview(), { wrapper });

    await waitFor(() => expect(result.current).toEqual({ guests: 40, reachableByEmail: 25, returned: 14, loyal: 6 }));
    expect(vi.mocked(CrmApi.getGuests).mock.calls.map(([params]) => params)).toEqual(
      expect.arrayContaining([
        { page: 1, pageSize: 1 },
        { reachableByEmail: true, page: 1, pageSize: 1 },
        { minStays: 2, page: 1, pageSize: 1 },
        { minStays: 3, page: 1, pageSize: 1 },
      ]),
    );
  });

  it('useCrmOverview_OneListFails_IsUndefinedSoTheStripIsNeverHalfDrawn', async () => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(CrmApi.getGuests).mockImplementation(async (params) => {
      if (params?.minStays === 3) throw new Error('boom');
      return { items: [], totalCount: 7, page: 1, pageSize: 1 };
    });

    const { result } = renderHook(() => useCrmOverview(), { wrapper });

    await waitFor(() => expect(CrmApi.getGuests).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(result.current).toBeUndefined();
  });

  it('useCrmOverview_ATagOrAMergeChangesTheList_ReadsTheNumbersAgain', async () => {
    const { result } = renderHook(() => useCrmOverview(), { wrapper });
    await waitFor(() => expect(result.current).toBeDefined());
    expect(CrmApi.getGuests).toHaveBeenCalledTimes(4);

    await client.invalidateQueries({ queryKey: CRM_GUESTS_KEY });

    expect(CrmApi.getGuests).toHaveBeenCalledTimes(8);
  });
});
