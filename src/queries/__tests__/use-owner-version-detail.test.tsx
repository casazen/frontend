import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ownerAccountingApi } from '@/api/owner-accounting.api';
import { entry, VERSION_ID, version } from '@/features/owner-accounting/__tests__/owner-accounting-fixtures';
import { queryClient as appQueryClient } from '@/lib/query-client';
import type { OwnerPortalTouristTax } from '@/types';
import { ownerAccountingKeys, useVersionDetail } from '../use-owner-accounting';

vi.mock('@/api/owner-accounting.api', () => ({ ownerAccountingApi: { getVersion: vi.fn() } }));

/** The tourist tax box of the statement as the server writes it: the stay and what the agency collected for it. */
const box = (amount: number): OwnerPortalTouristTax[] => [
  { property: 'Casa Lago', checkIn: '2025-01-10', checkOut: '2025-01-14', channel: 'Airbnb', bookingCode: 'BK-1001', currency: 'CHF', amount },
];

/** The client of the app as it is (five minutes of freshness, no read on mount unless asked): a client with no staleTime of its own would hide the case. */
function setup() {
  const client = new QueryClient({ defaultOptions: appQueryClient.getDefaultOptions() });
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
  return { client, wrapper };
}

/** The person comes back to the window (the tab is shown again): what the client does on that signal runs in the promises that follow, so they settle before anything is looked at. */
async function comeBackToTheWindow() {
  await act(async () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(ownerAccountingApi.getVersion).mockResolvedValue({ version: version(), entries: [entry()], touristTax: box(8) });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the statement of a version is kept fresh for half a minute, not for five (FIX/FE-OWNERS-ADOPT, money: the tourist tax box is worked out when it is read)', () => {
  it('useVersionDetail_ReadsAgainOnEveryVisit_AndKeepsAReadingFreshForHalfAMinuteAtMost', async () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useVersionDetail(VERSION_ID), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const options = client.getQueryCache().findAll({ queryKey: ownerAccountingKeys.version(VERSION_ID) })[0].observers[0].options;
    expect(options.refetchOnMount).toBe('always');
    // The app keeps data fresh for five minutes: without a staleTime of its own the statement would show the box as it was for all that time.
    expect(client.getDefaultOptions().queries?.staleTime).toBe(5 * 60 * 1000);
    expect(options.staleTime).toBeLessThanOrEqual(30_000);
  });

  it('useVersionDetail_AStatementLeftOpen_IsReadAgainOnReturnToTheWindowOnlyOnceItsReadingIsOlderThanHalfAMinute', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { wrapper } = setup();
      const { result } = renderHook(() => useVersionDetail(VERSION_ID), { wrapper });
      await waitFor(() => expect(result.current.data?.touristTax?.[0].amount).toBe(8));
      expect(ownerAccountingApi.getVersion).toHaveBeenCalledTimes(1);

      // Ten seconds after it was read the reading is recent: coming back to the window asks nothing.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      await comeBackToTheWindow();
      expect(ownerAccountingApi.getVersion).toHaveBeenCalledTimes(1);

      // Forty seconds after, it is not: the statement is read again and shows the box as the server has it now (the tax of a stay changed meanwhile).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      vi.mocked(ownerAccountingApi.getVersion).mockResolvedValue({ version: version(), entries: [entry()], touristTax: box(12) });
      await comeBackToTheWindow();

      await waitFor(() => expect(result.current.data?.touristTax?.[0].amount).toBe(12));
      expect(ownerAccountingApi.getVersion).toHaveBeenCalledTimes(2);
    } finally {
      focusManager.setFocused(undefined);
      vi.useRealTimers();
    }
  });
});
