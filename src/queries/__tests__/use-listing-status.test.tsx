import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListingStatus } from '@/types';
import { LISTING_SUMMARY_KEY, listingStatusKey, usePublishListing, useResolveOutsideChange, useListingStatus } from '../use-listing-status';

const { api } = vi.hoisted(() => ({
  api: { getStatus: vi.fn(), getSummary: vi.fn(), publish: vi.fn(), resolveOutsideChange: vi.fn() },
}));

vi.mock('@/api/listing-status.api', () => ({ listingStatusApi: api }));

const status = (...states: string[]): ListingStatus => ({
  propertyId: 'p1',
  channels: states.map((state, index) => ({
    channel: `channel_${index}`,
    status: state as never,
    completeness: 100,
    missing: [],
    lastSyncedAt: null,
    syncLagSeconds: null,
    syncAlert: false,
    errorCode: null,
    reason: null,
    reasonDetail: null,
    changedOutside: [],
  })),
  cinNotSentTo: [],
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, Wrapper };
}

describe('the status of the channels (E02/F03/US01/T04)', () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
  });

  it('useListingStatus_ARowIsSending_IsReadAgainEveryFiveSeconds_ElseNotAtAll', async () => {
    api.getStatus.mockResolvedValue(status('Published', 'Sending'));
    const { client, Wrapper } = setup();
    const { result } = renderHook(() => useListingStatus('p1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const query = client.getQueryCache().find({ queryKey: listingStatusKey('p1') })!;
    const interval = query.options.refetchInterval as (query: unknown) => number | false | undefined;
    expect(interval(query)).toBe(5000);

    client.setQueryData(listingStatusKey('p1'), status('Published', 'ToFix', 'ManagedOnChannel'));
    expect(interval(query)).toBe(false);
  });

  it('useListingStatus_ConnectorOff_AsksNothing', () => {
    const { Wrapper } = setup();
    renderHook(() => useListingStatus('p1', { enabled: false }), { wrapper: Wrapper });

    expect(api.getStatus).not.toHaveBeenCalled();
  });

  it('usePublishListing_Publishes_AndReadsTheStatusAndTheSummaryAgain', async () => {
    api.publish.mockResolvedValue({ propertyId: 'p1', channels: [] });
    const { client, Wrapper } = setup();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => usePublishListing('p1'), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ channels: ['booking_xml'], overwrite: false });
    });

    expect(api.publish).toHaveBeenCalledWith('p1', { channels: ['booking_xml'], overwrite: false });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: listingStatusKey('p1') });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: LISTING_SUMMARY_KEY });
  });

  it('usePublishListing_Refused_ReadsTheStatusAgainAllTheSame_AndTheErrorReachesTheCaller', async () => {
    api.publish.mockRejectedValue(new Error('409'));
    const { client, Wrapper } = setup();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => usePublishListing('p1'), { wrapper: Wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ channels: ['booking_xml'], overwrite: false });
      }),
    ).rejects.toThrow('409');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: listingStatusKey('p1') });
  });

  it('useResolveOutsideChange_TheChoiceGoesToTheChannel_AndTheStatusAndThePropertyAreReadAgain', async () => {
    api.resolveOutsideChange.mockResolvedValue(undefined);
    const { client, Wrapper } = setup();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useResolveOutsideChange('p1'), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ channelCode: 'booking_xml', choice: 'take' });
    });

    expect(api.resolveOutsideChange).toHaveBeenCalledWith('p1', 'booking_xml', 'take');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: listingStatusKey('p1') });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['properties', 'p1'] });
  });
});
