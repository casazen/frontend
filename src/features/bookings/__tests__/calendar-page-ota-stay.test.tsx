import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import { bookingsApi } from '@/api/bookings.api';
import { useProperties } from '@/queries/use-properties';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import { freezeClock, withBrowserTimeZone } from '@/test/clock';
import type { Booking } from '@/types';
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
vi.mock('@/api/bookings.api', () => ({ bookingsApi: { getCalendar: vi.fn(), createOtaStay: vi.fn() } }));
vi.mock('@/queries/use-properties', () => ({ useProperties: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// A reservation imported from Airbnb that the host can turn into an OTA stay (CO-21).
const AIRBNB_BLOCK: CalendarItemDto = {
  type: 'ical-block',
  id: 'blk1',
  propertyId: 'p1',
  startDate: '2026-09-30T00:00:00',
  endDate: '2026-10-02T00:00:00',
  startDateUtc: '2026-09-30T00:00:00Z',
  endDateUtc: '2026-10-02T00:00:00Z',
  summary: 'Reserved',
  channel: 'Airbnb',
  feedLabel: null,
  blockSource: 'ICalImport',
  feedId: 'feed-1',
  bookingId: null,
  convertible: true,
};

// An OTA stay whose reservation left the Airbnb calendar: "da verificare".
const STAY_TO_CHECK: CalendarItemDto = {
  type: 'booking',
  id: 'stay-9',
  propertyId: 'p1',
  startDate: '2026-09-30T00:00:00',
  endDate: '2026-10-02T00:00:00',
  startDateUtc: '2026-09-30T00:00:00Z',
  endDateUtc: '2026-10-02T00:00:00Z',
  status: 'Confirmed',
  source: 'Airbnb',
  guestName: 'Anna Verdi',
  icalFeedId: 'feed-1',
  otaReviewReason: 'BlockRemoved',
};

function calendarResponse(items: CalendarItemDto[]): CalendarResponseDto {
  return { timezone: 'Europe/Rome', utcOffsetMinutes: 120, bookings: [], items };
}

function renderPage(canWrite = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const workspace = {
    hasPermission: (context: string, permission: string) =>
      canWrite && context === 'short-rent' && permission === 'booking.write',
  } as unknown as WorkspaceContextValue;
  render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceContext.Provider value={workspace}>
        <MemoryRouter>
          <CalendarPage />
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
}

async function openBlock() {
  fireEvent.click(screen.getByRole('button', { name: 'Giorno' }));
  fireEvent.click(await screen.findByText('Airbnb'));
  return screen.getByRole('region', { name: 'Date bloccate su Airbnb' });
}

describe('CalendarPage OTA stays from iCal blocks (CO-21)', () => {
  withBrowserTimeZone('Europe/Rome');

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    freezeClock('2026-09-30T10:00:00Z');
    vi.mocked(useProperties).mockReturnValue({
      data: [{ id: 'p1', name: 'Casa Roma' }],
      isLoading: false,
    } as unknown as ReturnType<typeof useProperties>);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('BlockDetails_CreaSoggiornoOta_SendsTheGuestAndOpensTheNewStayOnTheGuestTab', async () => {
    vi.mocked(bookingsApi.getCalendar).mockResolvedValue(calendarResponse([AIRBNB_BLOCK]));
    vi.mocked(bookingsApi.createOtaStay).mockResolvedValue({ id: 'stay-1', status: 'Confirmed' } as Booking);
    renderPage();

    const details = await openBlock();
    fireEvent.click(within(details).getByRole('button', { name: 'Crea soggiorno OTA' }));
    fireEvent.change(within(details).getByLabelText('Nome ospite'), { target: { value: 'Mario' } });
    fireEvent.change(within(details).getByLabelText('Cognome ospite'), { target: { value: 'Rossi' } });
    fireEvent.change(within(details).getByLabelText('Email ospite'), { target: { value: 'mario@example.com' } });
    fireEvent.click(within(details).getByRole('button', { name: 'Crea soggiorno' }));

    await waitFor(() =>
      expect(bookingsApi.createOtaStay).toHaveBeenCalledWith('blk1', {
        firstName: 'Mario',
        lastName: 'Rossi',
        email: 'mario@example.com',
      }),
    );
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/app/short-rent/bookings/stay-1?tab=guest'));
  });

  it('BlockDetails_WithoutBookingWrite_OffersNoConversion', async () => {
    vi.mocked(bookingsApi.getCalendar).mockResolvedValue(calendarResponse([AIRBNB_BLOCK]));
    renderPage(false);

    const details = await openBlock();

    expect(within(details).getByText('Non hai i permessi per creare soggiorni.')).toBeInTheDocument();
    expect(within(details).queryByRole('button', { name: 'Crea soggiorno OTA' })).not.toBeInTheDocument();
  });

  it('BlockDetails_BlockAlreadyAStay_LinksTheStayInsteadOfConverting', async () => {
    vi.mocked(bookingsApi.getCalendar).mockResolvedValue(
      calendarResponse([{ ...AIRBNB_BLOCK, bookingId: 'stay-9', convertible: false }]),
    );
    renderPage();

    const details = await openBlock();

    expect(within(details).getByTestId('calendar-block-open-stay')).toHaveAttribute('href', '/app/short-rent/bookings/stay-9');
    expect(within(details).queryByRole('button', { name: 'Crea soggiorno OTA' })).not.toBeInTheDocument();
  });

  it('Calendar_StayToCheck_HasItsOwnStyleAndLegendEntry', async () => {
    vi.mocked(bookingsApi.getCalendar).mockResolvedValue(calendarResponse([STAY_TO_CHECK]));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Giorno' }));

    const title = await screen.findByText('Anna Verdi');

    expect(screen.getByRole('list', { name: 'Legenda del calendario' })).toHaveTextContent('Soggiorno OTA da verificare');
    expect(title.closest('.host-calendar-event')).toHaveClass('host-calendar-event--toReview');
    // The tooltip of the event says it too.
    expect(title.closest('[title]')).toHaveAttribute('title', expect.stringContaining('Da verificare'));
  });
});
