import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { publicOrgApi } from '@/api/public-org.api';
import type { PublicCalendarDto } from '@/types';
import { usePublicPropertyCalendar } from '../use-public-calendar';

vi.mock('@/api/public-org.api', () => ({ publicOrgApi: { getOrgPropertyCalendar: vi.fn() } }));

/**
 * The calendar of a home as the pickers draw it: what the server says of each night, rule by rule (E08/F05/US01, NF-36). A day that
 * the server sends without rules (or an older server that sends none of the fields) must come out as a day with no rule.
 */
const calendar: PublicCalendarDto = {
  propertyId: 'p-1',
  startDate: '2026-11-02',
  endDate: '2026-11-05',
  today: '2026-11-02',
  currency: 'EUR',
  generatedAt: '2026-11-02T08:00:00Z',
  days: [
    { date: '2026-11-02', available: true, nightlyPriceCents: 15000, minNights: 1 },
    {
      date: '2026-11-03',
      available: true,
      nightlyPriceCents: 16000,
      minNights: 2,
      maxNights: 7,
      closedToArrival: true,
      closedToDeparture: true,
      minAdvanceDays: 1,
      maxAdvanceDays: 365,
    },
    {
      date: '2026-11-04',
      available: true,
      nightlyPriceCents: 15000,
      minNights: 1,
      maxNights: null,
      closedToArrival: false,
      closedToDeparture: false,
      minAdvanceDays: null,
      maxAdvanceDays: null,
    },
  ],
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('usePublicPropertyCalendar', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('UsePublicPropertyCalendar_DayWithRules_CopiesEveryRuleToTheDay', async () => {
    vi.mocked(publicOrgApi.getOrgPropertyCalendar).mockResolvedValue(calendar);
    const { result } = renderHook(() => usePublicPropertyCalendar('demo', 'villa-mare'), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.days[1]).toEqual({
      date: '2026-11-03',
      available: true,
      priceCents: 16000,
      minNights: 2,
      maxNights: 7,
      closedToArrival: true,
      closedToDeparture: true,
      minAdvanceDays: 1,
      maxAdvanceDays: 365,
    });
  });

  it('UsePublicPropertyCalendar_DayWithoutTheFields_IsADayWithNoRule', async () => {
    vi.mocked(publicOrgApi.getOrgPropertyCalendar).mockResolvedValue(calendar);
    const { result } = renderHook(() => usePublicPropertyCalendar('demo', 'villa-mare'), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('ready'));

    const noRule = {
      maxNights: null,
      closedToArrival: false,
      closedToDeparture: false,
      minAdvanceDays: null,
      maxAdvanceDays: null,
    };
    // The day an older server sends (no field) and the day a current server sends with nothing set come out the same.
    expect(result.current.days[0]).toEqual({ date: '2026-11-02', available: true, priceCents: 15000, minNights: 1, ...noRule });
    expect(result.current.days[2]).toEqual({ date: '2026-11-04', available: true, priceCents: 15000, minNights: 1, ...noRule });
  });
});
