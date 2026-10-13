import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { bookingsApi } from '@/api/bookings.api';
import { useProperties } from '@/queries/use-properties';
import { freezeClock, NOON_UTC, withBrowserTimeZone } from '@/test/clock';
import type { CalendarItemDto, CalendarResponseDto } from '@/types/calendar.types';
import { CalendarPage } from '../calendar-page';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/api/bookings.api', () => ({ bookingsApi: { getCalendar: vi.fn() } }));
vi.mock('@/queries/use-properties', () => ({ useProperties: vi.fn() }));

const BOOKING: CalendarItemDto = {
  type: 'booking',
  id: 'b1',
  propertyId: 'p1',
  // Stay dates without time zone (backend MO-06): arrival on the 30th, departure on 2 October.
  startDate: '2026-09-30T00:00:00',
  endDate: '2026-10-02T00:00:00',
  startDateUtc: '2026-09-30T00:00:00Z',
  endDateUtc: '2026-10-02T00:00:00Z',
  status: 'Confirmed',
  source: 'Manual',
  guestName: 'Mario Rossi',
};

const AIRBNB_BLOCK: CalendarItemDto = {
  type: 'ical-block',
  id: 'blk1',
  propertyId: 'p1',
  startDate: '2026-09-30T00:00:00',
  endDate: '2026-10-01T00:00:00',
  startDateUtc: '2026-09-30T00:00:00Z',
  endDateUtc: '2026-10-01T00:00:00Z',
  summary: 'Reserved',
  channel: 'Airbnb',
  feedLabel: null,
};

function calendarResponse(items: CalendarItemDto[]): CalendarResponseDto {
  return { timezone: 'Europe/Rome', utcOffsetMinutes: 120, bookings: [], items };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function lastRange() {
  const calls = vi.mocked(bookingsApi.getCalendar).mock.calls;
  return calls[calls.length - 1]?.[0];
}

async function expectRange(startDate: string, endDate: string) {
  await waitFor(() => expect(lastRange()).toEqual({ propertyId: 'p1', startDate, endDate }));
}

/** The entries of the range are on screen: while they load the calendar shows none, so an absence proves nothing. */
async function waitForEntries() {
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
}

describe('CalendarPage navigation and entries (PC-08)', () => {
  withBrowserTimeZone('Europe/Rome');

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    vi.mocked(useProperties).mockReturnValue({
      data: [{ id: 'p1', name: 'Casa Roma' }],
      isLoading: false,
    } as unknown as ReturnType<typeof useProperties>);
    vi.mocked(bookingsApi.getCalendar).mockResolvedValue(calendarResponse([]));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('CalendarPage_NextMonthFromSeptember_AsksForOctoberFirstToThirtyFirst', async () => {
    freezeClock(NOON_UTC);
    renderPage();
    await expectRange('2026-09-01', '2026-09-30');

    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));

    await expectRange('2026-10-01', '2026-10-31');
    expect(bookingsApi.getCalendar).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/ottobre 2026/i)).toBeInTheDocument();
  });

  it('CalendarPage_WeekAndDayViews_AskForTheWeekAndTheDayShown', async () => {
    // Thursday 24 September 2026.
    freezeClock(NOON_UTC);
    renderPage();
    await expectRange('2026-09-01', '2026-09-30');

    fireEvent.click(screen.getByRole('button', { name: 'Settimana' }));
    await expectRange('2026-09-21', '2026-09-27');

    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    await expectRange('2026-09-28', '2026-10-04');

    fireEvent.click(screen.getByRole('button', { name: 'Giorno' }));
    await expectRange('2026-10-01', '2026-10-01');

    fireEvent.click(screen.getByRole('button', { name: 'Oggi' }));
    await expectRange('2026-09-24', '2026-09-24');
  });

  it('CalendarPage_WhileTheRangeLoads_ShowsLoadingOverTheCalendar', async () => {
    freezeClock(NOON_UTC);
    vi.mocked(bookingsApi.getCalendar).mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(await screen.findByRole('status')).toHaveTextContent('Caricamento calendario...');
    expect(screen.getByRole('button', { name: 'Avanti' })).toBeInTheDocument();
  });

  describe('in a browser west of UTC', () => {
    // new Date('2026-09-30') is the evening of the 29th in Los Angeles: the entries must not move.
    withBrowserTimeZone('America/Los_Angeles');

    it('CalendarPage_BookingArrivingOn30September_ShowsOnTheNightsFromThe30th', async () => {
      freezeClock('2026-09-30T10:00:00Z');
      vi.mocked(bookingsApi.getCalendar).mockResolvedValue(calendarResponse([BOOKING]));
      renderPage();
      await expectRange('2026-09-01', '2026-09-30');

      fireEvent.click(screen.getByRole('button', { name: 'Giorno' }));
      await expectRange('2026-09-30', '2026-09-30');
      await waitForEntries();
      expect(screen.getByText('Mario Rossi')).toBeInTheDocument();

      // The API answers with the same entry for every range: only its dates decide the days it is on.
      fireEvent.click(screen.getByRole('button', { name: 'Indietro' }));
      await expectRange('2026-09-29', '2026-09-29');
      await waitForEntries();
      expect(screen.queryByText('Mario Rossi')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
      fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
      await expectRange('2026-10-01', '2026-10-01');
      await waitForEntries();
      expect(screen.getByText('Mario Rossi')).toBeInTheDocument();

      // Departure day: the guest leaves in the morning, the day is free for the next arrival.
      fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
      await expectRange('2026-10-02', '2026-10-02');
      await waitForEntries();
      expect(screen.queryByText('Mario Rossi')).not.toBeInTheDocument();
    });
  });

  it('CalendarPage_ClickOnIcalBlock_ShowsItsChannelAndOpensNoBookingDetail', async () => {
    freezeClock('2026-09-30T10:00:00Z');
    vi.mocked(bookingsApi.getCalendar).mockResolvedValue(calendarResponse([BOOKING, AIRBNB_BLOCK]));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Giorno' }));

    fireEvent.click(await screen.findByText('Airbnb'));

    expect(navigateMock).not.toHaveBeenCalled();
    const details = screen.getByRole('region', { name: 'Date bloccate su Airbnb' });
    expect(within(details).getByText(/non sono una prenotazione CasaZen/)).toBeInTheDocument();
    expect(within(details).getByText('Evento del calendario: Reserved')).toBeInTheDocument();
    expect(within(details).getByText(/1 notte/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Mario Rossi'));

    expect(navigateMock).toHaveBeenCalledWith('/app/short-rent/bookings/b1');
  });

  it('CalendarPage_CalendarRequestFails_ShowsTheErrorAndNoEmptyCalendar', async () => {
    freezeClock(NOON_UTC);
    const forbidden = new AxiosError('Forbidden', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { status: 403, title: 'Forbidden' },
    });
    vi.mocked(bookingsApi.getCalendar).mockRejectedValue(forbidden);
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Impossibile caricare il calendario');
    expect(alert).toHaveTextContent(i18n.t('apiErrors.forbidden'));
    expect(screen.queryByRole('button', { name: 'Avanti' })).not.toBeInTheDocument();
    expect(screen.queryByText('Nessuna prenotazione in questo periodo.')).not.toBeInTheDocument();

    vi.mocked(bookingsApi.getCalendar).mockResolvedValue(calendarResponse([]));
    fireEvent.click(within(alert).getByRole('button', { name: 'Riprova' }));

    expect(await screen.findByRole('button', { name: 'Avanti' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
