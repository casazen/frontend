import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { bookingsApi } from '@/api/bookings.api';
import { fetchSupplierInboxCounts } from '@/services/supplier-api';
import { ROUTE_MANIFEST, type RouteManifestEntry } from '@/config/route-manifest';
import { useNavCounts } from '../use-nav-counts';

vi.mock('@/api/bookings.api', () => ({ bookingsApi: { getApprovalRequests: vi.fn() } }));
vi.mock('@/services/supplier-api', () => ({ fetchSupplierInboxCounts: vi.fn() }));

const entry = (path: string) => ROUTE_MANIFEST.find((candidate) => candidate.path === path) as RouteManifestEntry;
const bookings = entry('/app/short-rent/bookings');
const inbox = entry('/app/supplier/inbox');
const dashboard = entry('/app/short-rent');

function render(entries: RouteManifestEntry[], client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })) {
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, ...renderHook(() => useNavCounts(entries), { wrapper }) };
}

describe('useNavCounts (UI-04a)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('NavCounts_MenuWithoutCounters_AsksNothing', () => {
    const { result } = render([dashboard]);

    expect(result.current).toEqual({});
    expect(bookingsApi.getApprovalRequests).not.toHaveBeenCalled();
    expect(fetchSupplierInboxCounts).not.toHaveBeenCalled();
  });

  it('NavCounts_BookingsEntry_CountsTheRequestsWaitingForTheHost', async () => {
    vi.mocked(bookingsApi.getApprovalRequests).mockResolvedValue([{ id: 'a' }, { id: 'b' }] as never);
    const { result } = render([dashboard, bookings]);

    await waitFor(() => expect(result.current).toEqual({ bookingRequests: 2 }));
    expect(fetchSupplierInboxCounts).not.toHaveBeenCalled();
  });

  it('NavCounts_NoRequest_IsAZeroTheEntryDoesNotShow', async () => {
    vi.mocked(bookingsApi.getApprovalRequests).mockResolvedValue([]);
    const { result } = render([bookings]);

    await waitFor(() => expect(result.current).toEqual({ bookingRequests: 0 }));
  });

  it('NavCounts_InboxEntry_CountsTheRequestsAwaitingTheAnswerOfTheSupplier', async () => {
    // Three wait for the answer of the supplier and two for the customer: the menu counts only the first.
    vi.mocked(fetchSupplierInboxCounts).mockResolvedValue({ toAnswer: 3, awaitingCustomer: 2, scheduled: 1, toCollect: 0, archive: 0, paymentsLate: 0 });
    const { result } = render([inbox]);

    await waitFor(() => expect(result.current).toEqual({ supplierRequests: 3 }));
    // The counters of the chips of the list: the cache entry is shared with the page.
    expect(fetchSupplierInboxCounts).toHaveBeenCalledTimes(1);
    expect(bookingsApi.getApprovalRequests).not.toHaveBeenCalled();
  });

  it('NavCounts_RequestsFail_LeaveTheEntryWithoutACounterAndSayNothing', async () => {
    vi.mocked(bookingsApi.getApprovalRequests).mockRejectedValue(new Error('boom'));
    const { result, client } = render([bookings]);

    await waitFor(() => expect(client.getQueryState(['bookings', 'approval-requests'])?.status).toBe('error'));
    expect(result.current).toEqual({});
  });

  it('NavCounts_AnswerOfAnotherShape_IsNotACount', async () => {
    // A server or a proxy that answers with a page instead of the API (the dev server does for unknown addresses).
    vi.mocked(bookingsApi.getApprovalRequests).mockResolvedValue('<!doctype html><html></html>' as never);
    vi.mocked(fetchSupplierInboxCounts).mockResolvedValue('<!doctype html><html></html>' as never);
    const { result, client } = render([bookings, inbox]);

    await waitFor(() => expect(client.getQueryState(['bookings', 'approval-requests'])?.status).toBe('success'));
    await waitFor(() => expect(client.getQueryState(['supplier', 'inbox', 'counts'])?.status).toBe('success'));
    expect(result.current).toEqual({});
  });

  it('NavCounts_PageAlreadyLoadedTheNumbers_ReadsTheSameCacheEntry', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(['bookings', 'approval-requests'], [{ id: 'a' }]);
    client.setQueryData(['supplier', 'inbox', 'counts'], { toAnswer: 5, awaitingCustomer: 4 });

    const { result } = render([bookings, inbox], client);

    expect(result.current).toEqual({ bookingRequests: 1, supplierRequests: 5 });
    expect(bookingsApi.getApprovalRequests).not.toHaveBeenCalled();
    expect(fetchSupplierInboxCounts).not.toHaveBeenCalled();
  });
});
