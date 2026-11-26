import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { publicOrgApi } from '@/api/public-org.api';
import { publicSiteSearchApi } from '@/api/public-site-search.api';
import type { PublicCalendarDto } from '@/types';
import type { PublicSiteCalendar } from '@/types/public-stays.types';
import { usePublicPropertyCalendar } from '../use-public-calendar';
import { usePublicSiteCalendar } from '../use-public-site-calendar';

vi.mock('@/api/public-org.api', () => ({ publicOrgApi: { getOrgPropertyCalendar: vi.fn() } }));
vi.mock('@/api/public-site-search.api', () => ({ publicSiteSearchApi: { getSiteCalendar: vi.fn(), getPlatformCalendar: vi.fn() } }));

/**
 * CHF-MONEY, the calendar hooks: the currency of the calendar is the one the server says. While the nights load and when they cannot be read there is no
 * currency (`null`, and no price is drawn): never a euro made up for the time being. A server that answers with a calendar that says none keeps it so.
 */
const propertyCalendar: PublicCalendarDto = {
  propertyId: 'p-1',
  startDate: '2026-11-02',
  endDate: '2026-11-05',
  today: '2026-11-02',
  currency: 'CHF',
  generatedAt: '2026-11-02T08:00:00Z',
  days: [{ date: '2026-11-02', available: true, nightlyPriceCents: 15000, minNights: 1 }],
};

const siteCalendar: PublicSiteCalendar = {
  from: '2026-11-02',
  to: '2026-11-05',
  today: '2026-11-02',
  currency: 'CHF',
  adults: 2,
  children: 0,
  days: [{ date: '2026-11-02', anyAvailable: true, fromPriceCents: 15000, minNights: 1 }],
  generatedAt: '2026-11-02T08:00:00Z',
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('the calendar of a home', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('UsePublicPropertyCalendar_WhileLoading_HasNoCurrencyAndNeverTheEuro', () => {
    vi.mocked(publicOrgApi.getOrgPropertyCalendar).mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => usePublicPropertyCalendar('demo', 'villa-mare'), { wrapper });

    expect(result.current.status).toBe('loading');
    expect(result.current.currency).toBeNull();
  });

  it('UsePublicPropertyCalendar_WhenItFails_HasNoCurrencyAndNeverTheEuro', async () => {
    vi.mocked(publicOrgApi.getOrgPropertyCalendar).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => usePublicPropertyCalendar('demo', 'villa-mare'), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.currency).toBeNull();
  });

  it('UsePublicPropertyCalendar_CalendarThatSaysACurrencyOrNone_KeepsWhatItSays', async () => {
    vi.mocked(publicOrgApi.getOrgPropertyCalendar).mockResolvedValue(propertyCalendar);
    const franc = renderHook(() => usePublicPropertyCalendar('demo', 'villa-mare'), { wrapper });
    await waitFor(() => expect(franc.result.current.status).toBe('ready'));
    expect(franc.result.current.currency).toBe('CHF');

    vi.mocked(publicOrgApi.getOrgPropertyCalendar).mockResolvedValue({ ...propertyCalendar, currency: '' });
    const silent = renderHook(() => usePublicPropertyCalendar('other', 'villa-lago'), { wrapper });
    await waitFor(() => expect(silent.result.current.status).toBe('ready'));
    expect(silent.result.current.currency).toBe('');
  });
});

describe('the calendar of a whole site', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('UsePublicSiteCalendar_WhileLoading_HasNoCurrencyAndNeverTheEuro', () => {
    vi.mocked(publicSiteSearchApi.getSiteCalendar).mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => usePublicSiteCalendar('demo', { adults: 2, children: 0 }), { wrapper });

    expect(result.current.status).toBe('loading');
    expect(result.current.currency).toBeNull();
  });

  it('UsePublicSiteCalendar_WhenItFails_HasNoCurrencyAndNeverTheEuro', async () => {
    vi.mocked(publicSiteSearchApi.getSiteCalendar).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => usePublicSiteCalendar('demo', { adults: 2, children: 0 }), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.currency).toBeNull();
  });

  it('UsePublicSiteCalendar_CalendarThatSaysACurrency_KeepsIt', async () => {
    vi.mocked(publicSiteSearchApi.getSiteCalendar).mockResolvedValue(siteCalendar);
    const { result } = renderHook(() => usePublicSiteCalendar('demo', { adults: 2, children: 0 }), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.currency).toBe('CHF');
  });
});
