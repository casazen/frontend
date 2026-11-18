import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { octorateApi } from '@/api/octorate.api';
import { calendarApi } from '@/api/calendar.api';
import { useConfirmMapping } from '../use-octorate-mapping';
import { useHostCalendar } from '../use-host-calendar';

vi.mock('@/api/octorate.api', () => ({ octorateApi: { confirmMapping: vi.fn() } }));
vi.mock('@/api/calendar.api', () => ({ calendarApi: { getHostCalendar: vi.fn() } }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('reads a previously empty calendar again after a mapping is confirmed', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnMount: false, staleTime: 300_000 } } });
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
  const query = { from: '2026-11-15', to: '2026-11-28' };
  vi.mocked(calendarApi.getHostCalendar).mockResolvedValue({ items: [] } as unknown as Awaited<ReturnType<typeof calendarApi.getHostCalendar>>);
  vi.mocked(octorateApi.confirmMapping).mockResolvedValue(undefined);
  const calendar = renderHook(() => useHostCalendar(query), { wrapper });
  await waitFor(() => expect(calendar.result.current.isSuccess).toBe(true));
  const mapping = renderHook(() => useConfirmMapping(), { wrapper });
  await act(async () => { await mapping.result.current.mutateAsync({ listingId: 'listing-1', propertyId: 'property-1' }); });
  await waitFor(() => expect(calendarApi.getHostCalendar).toHaveBeenCalledTimes(2));
  client.clear();
});
