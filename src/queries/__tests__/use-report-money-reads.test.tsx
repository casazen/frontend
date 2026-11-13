import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { reportChannelCostsApi } from '@/api/report-channel-costs.api';
import { reportCollectionsApi } from '@/api/report-collections.api';
import type { ReportPeriod } from '@/api/reports.api';
import { queryClient as appQueryClient } from '@/lib/query-client';
import { REPORT_CHANNEL_COSTS_KEY, useChannelCostsReport } from '../use-report-channel-costs';
import { REPORT_COLLECTIONS_KEY, useBalancesToCollect, useCollectionsReport } from '../use-report-collections';

// The money reads of the host (NF-97, NF-98): the figures change from other screens and without any screen at all, and they are the amounts of
// the host. They are asked of the server every time they are opened, they are stale as soon as they arrive, nothing keeps them once the page
// is left, and the figures of another period or property are never shown under the new one. The client here has the defaults of the app
// (fresh for 5 minutes, kept for 10, no read on mount): what the hooks must override.
vi.mock('@/api/report-collections.api', () => ({ reportCollectionsApi: { getCollections: vi.fn(), getBalancesToCollect: vi.fn() } }));
vi.mock('@/api/report-channel-costs.api', () => ({ reportChannelCostsApi: { getChannelCosts: vi.fn() } }));

interface Input {
  period: ReportPeriod;
  propertyId: string;
}

interface Read {
  data: unknown;
  isSuccess: boolean;
  isStale: boolean;
  isPlaceholderData: boolean;
}

const FIRST: Input = { period: { from: '2026-09-01', to: '2026-09-30' }, propertyId: 'p-1' };
const OTHER: Input = { period: { from: '2026-08-01', to: '2026-08-31' }, propertyId: 'p-2' };

/** The three money reads: the hook, the call it makes to the server and the key under which the query is kept. */
const READS: ReadonlyArray<{ name: string; useRead: (input: Input) => Read; call: () => ReturnType<typeof vi.fn>; key: (input: Input) => unknown[] }> = [
  {
    name: 'useCollectionsReport',
    useRead: ({ period, propertyId }) => useCollectionsReport(period, propertyId, true),
    call: () => vi.mocked(reportCollectionsApi.getCollections) as unknown as ReturnType<typeof vi.fn>,
    key: ({ period, propertyId }) => [REPORT_COLLECTIONS_KEY, 'collections', period.from, period.to, propertyId],
  },
  {
    name: 'useBalancesToCollect',
    useRead: ({ propertyId }) => useBalancesToCollect(propertyId, true),
    call: () => vi.mocked(reportCollectionsApi.getBalancesToCollect) as unknown as ReturnType<typeof vi.fn>,
    key: ({ propertyId }) => [REPORT_COLLECTIONS_KEY, 'balances-to-collect', propertyId],
  },
  {
    name: 'useChannelCostsReport',
    useRead: ({ period, propertyId }) => useChannelCostsReport(period, propertyId, true),
    call: () => vi.mocked(reportChannelCostsApi.getChannelCosts) as unknown as ReturnType<typeof vi.fn>,
    key: ({ period, propertyId }) => [REPORT_CHANNEL_COSTS_KEY, period.from, period.to, propertyId],
  },
];

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { ...appQueryClient.getDefaultOptions().queries, retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe('the money reads: always fresh, never kept, never the figures of another period (NF-97, NF-98)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => cleanup());

  it.each(READS)('$name_IsStaleAtOnceAndNothingKeepsItOnceThePageIsLeft', async ({ useRead, call, key }) => {
    call().mockResolvedValue({ figures: 1 });
    const { client, wrapper } = setup();

    const first = renderHook(() => useRead(FIRST), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    // Stale as soon as it arrives (not fresh for 5 minutes) and kept for no time (not for 10) once nothing shows it.
    expect(first.result.current.isStale).toBe(true);
    expect(client.getQueryCache().find({ queryKey: key(FIRST) })?.options.gcTime).toBe(0);

    first.unmount();
    await waitFor(() => expect(client.getQueryCache().find({ queryKey: key(FIRST) })).toBeUndefined());

    // Opened again: nothing is left to show, and the figures are asked of the server again.
    const second = renderHook(() => useRead(FIRST), { wrapper });
    expect(second.result.current.data).toBeUndefined();
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));
    expect(call()).toHaveBeenCalledTimes(2);
  });

  it.each(READS)('$name_OpenedWithOldFiguresStillInTheCache_AsksTheServerAndShowsTheNewOnes', async ({ useRead, call, key }) => {
    call().mockResolvedValue({ figures: 'new' });
    const { client, wrapper } = setup();
    client.setQueryData(key(FIRST), { figures: 'old' });

    const { result } = renderHook(() => useRead(FIRST), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual({ figures: 'new' }));
    expect(call()).toHaveBeenCalledTimes(1);
  });

  it.each(READS)('$name_AnotherPeriodOrProperty_ShowsNothingOfTheFiguresOfTheOneBefore', async ({ useRead, call }) => {
    call().mockResolvedValueOnce({ figures: 'before' });
    const { wrapper } = setup();
    const { result, rerender } = renderHook((input: Input) => useRead(input), { wrapper, initialProps: FIRST });
    await waitFor(() => expect(result.current.data).toEqual({ figures: 'before' }));

    // The next read never answers: while it is on its way there is nothing to show, and nothing that looks like the figures of the new days.
    call().mockReturnValueOnce(new Promise(() => undefined));
    rerender(OTHER);

    expect(result.current.data).toBeUndefined();
    expect(result.current.isPlaceholderData).toBe(false);
  });
});
