import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { calendarDaysApi } from '@/api/calendar-days.api';
import type { CalendarDaysResponse } from '@/types/calendar-days.types';
import { useDayLayer } from './use-day-layer';

vi.mock('@/api/calendar-days.api', () => ({ calendarDaysApi: { getDays: vi.fn() } }));

const QUERY = { from: '2026-09-10', to: '2026-09-16' };
const RESPONSE: CalendarDaysResponse = {
  today: '2026-09-12',
  properties: [{ propertyId: 'p1', timezone: 'Europe/Rome', currency: 'EUR', mirrored: true, days: [] }],
};

function statusError(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, { status, statusText: '', headers: {}, config, data: {} });
}

function wrapper({ children }: { children: ReactNode }) {
  // The hook retries a transient failure once (as every read of the calendar): no delay in the test.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return createElement(QueryClientProvider, { client }, children);
}

describe('useDayLayer (E08/F05/US03/T01, permission rule)', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('useDayLayer_WithoutTheRightToReadProperties_AsksForNothingAndShowsNoError', () => {
    const { result } = renderHook(() => useDayLayer(QUERY, false), { wrapper });

    expect(calendarDaysApi.getDays).not.toHaveBeenCalled();
    expect(result.current.layer).toBeUndefined();
    expect(result.current.failed).toBe(false);
  });

  it('useDayLayer_A403_IsNoLayerAndNoErrorState', async () => {
    vi.mocked(calendarDaysApi.getDays).mockRejectedValue(statusError(403));
    const { result } = renderHook(() => useDayLayer(QUERY, true), { wrapper });

    await waitFor(() => expect(calendarDaysApi.getDays).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.layer).toBeUndefined());
    expect(result.current.failed).toBe(false);
  });

  it('useDayLayer_AnyOtherFailure_IsSaidAndTheLayerIsNotDrawn', async () => {
    vi.mocked(calendarDaysApi.getDays).mockRejectedValue(statusError(500));
    const { result } = renderHook(() => useDayLayer(QUERY, true), { wrapper });

    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.layer).toBeUndefined();
  });

  it('useDayLayer_ARead_IsTheLayerOfEachProperty', async () => {
    vi.mocked(calendarDaysApi.getDays).mockResolvedValue(RESPONSE);
    const { result } = renderHook(() => useDayLayer(QUERY, true), { wrapper });

    await waitFor(() => expect(result.current.layer?.get('p1')).toMatchObject({ currency: 'EUR', mirrored: true }));
    expect(result.current.failed).toBe(false);
  });

  it('useDayLayer_NoRange_AsksForNothing', () => {
    const { result } = renderHook(() => useDayLayer(undefined, true), { wrapper });

    expect(calendarDaysApi.getDays).not.toHaveBeenCalled();
    expect(result.current.layer).toBeUndefined();
  });
});
