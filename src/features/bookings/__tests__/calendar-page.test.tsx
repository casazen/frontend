import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { useBookingCalendar } from '@/queries/use-bookings';
import { useProperties } from '@/queries/use-properties';
import { LATE_EVENING_UTC, NOON_UTC, freezeClock, withBrowserTimeZone } from '@/test/clock';
import { CalendarPage } from '../calendar-page';

vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('../components/booking-calendar', () => ({
  BookingCalendar: () => createElement('div', { 'data-testid': 'booking-calendar' }),
}));
vi.mock('@/queries/use-bookings', () => ({ useBookingCalendar: vi.fn() }));
vi.mock('@/queries/use-properties', () => ({ useProperties: vi.fn() }));

function renderPage() {
  render(
    <MemoryRouter>
      <CalendarPage />
    </MemoryRouter>,
  );
}

describe('CalendarPage month range (QA-CLOCK-FE)', () => {
  // In Rome a local midnight is the day before in UTC: the old toISOString() range was 31 August - 29 September.
  withBrowserTimeZone('Europe/Rome');

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    vi.mocked(useProperties).mockReturnValue({
      data: [{ id: 'p1', name: 'Casa Roma' }],
      isLoading: false,
    } as unknown as ReturnType<typeof useProperties>);
    vi.mocked(useBookingCalendar).mockReturnValue({
      data: { bookings: [], items: [] },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useBookingCalendar>);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('CalendarPage_At2330UtcOf24September_AsksForTheWholeMonthOfSeptember', () => {
    freezeClock(LATE_EVENING_UTC);

    renderPage();

    expect(useBookingCalendar).toHaveBeenLastCalledWith({
      propertyId: 'p1',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });
  });

  it('CalendarPage_AtNoonUtc_AsksForTheSameMonth', () => {
    freezeClock(NOON_UTC);

    renderPage();

    expect(useBookingCalendar).toHaveBeenLastCalledWith({
      propertyId: 'p1',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });
  });

  it('CalendarPage_FirstNightOfTheMonthInRome_AsksForTheNewMonth', () => {
    // 22:30 UTC of 30 September is 00:30 of 1 October in Rome.
    freezeClock('2026-09-30T22:30:00Z');

    renderPage();

    expect(useBookingCalendar).toHaveBeenLastCalledWith({
      propertyId: 'p1',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    });
  });
});
