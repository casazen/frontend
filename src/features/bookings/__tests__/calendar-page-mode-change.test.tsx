import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import { bookingsApi } from '@/api/bookings.api';
import { manualBlocksApi } from '@/api/manual-blocks.api';
import { useProperties } from '@/queries/use-properties';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import { freezeClock, withBrowserTimeZone } from '@/test/clock';
import type { CalendarItemDto, CalendarResponseDto } from '@/types/calendar.types';
import { CalendarPage } from '../calendar-page';

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/api/bookings.api', () => ({ bookingsApi: { getCalendar: vi.fn(), createOtaStay: vi.fn() } }));
vi.mock('@/api/manual-blocks.api', () => ({ manualBlocksApi: { create: vi.fn(), remove: vi.fn() } }));
vi.mock('@/queries/use-properties', () => ({ useProperties: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// The nights a scheduled change to long-term closes: from the night before the day of the change (PM-02).
const MODE_CHANGE_BLOCK: CalendarItemDto = {
  type: 'ical-block',
  id: 'mc1',
  propertyId: 'p1',
  startDate: '2026-09-29T00:00:00',
  endDate: '2028-10-01T00:00:00',
  startDateUtc: '2026-09-29T00:00:00Z',
  endDateUtc: '2028-10-01T00:00:00Z',
  summary: null,
  channel: null,
  feedLabel: null,
  blockSource: 'Manual',
  blockReason: 'ModeChange',
  feedId: null,
  bookingId: null,
  convertible: false,
};

function calendarResponse(items: CalendarItemDto[]): CalendarResponseDto {
  return { timezone: 'Europe/Rome', utcOffsetMinutes: 120, bookings: [], items };
}

function renderPage({ permissions = ['property.write', 'booking.write'] }: { permissions?: string[] } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const workspace = {
    hasPermission: (context: string, permission: string) => context === 'short-rent' && permissions.includes(permission),
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

async function openTheBlock() {
  fireEvent.click(screen.getByRole('button', { name: 'Giorno' }));
  fireEvent.click(await screen.findByText("Passaggio all'affitto lungo"));
  return screen.getByRole('region', { name: "Date chiuse: Passaggio all'affitto lungo" });
}

describe('CalendarPage: the nights closed by a change of mode (PM-03)', () => {
  withBrowserTimeZone('Europe/Rome');

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    freezeClock('2026-09-30T10:00:00Z');
    vi.mocked(useProperties).mockReturnValue({
      data: [{ id: 'p1', name: 'Casa Roma' }],
      isLoading: false,
    } as unknown as ReturnType<typeof useProperties>);
    vi.mocked(bookingsApi.getCalendar).mockResolvedValue(calendarResponse([MODE_CHANGE_BLOCK]));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('CalendarPage_ModeChangeBlock_HasItsOwnNameAndCannotBeDeletedFromHere', async () => {
    renderPage();

    const details = await openTheBlock();

    // Said as it is: the host did not close these nights, the change did, and they open again if the change is cancelled.
    const block = within(details).getByTestId('mode-change-block');
    expect(block).toHaveTextContent(i18n.t('propertyMode.calendar.explanation'));
    expect(block).toHaveTextContent(i18n.t('propertyMode.calendar.reopen'));
    expect(within(details).queryByRole('button', { name: 'Elimina blocco' })).not.toBeInTheDocument();
    expect(within(details).queryByText(i18n.t('booking.calendar.manualBlock.explanation'))).not.toBeInTheDocument();
    expect(within(details).getByTestId('mode-change-block-manage')).toHaveAttribute('href', '/app/short-rent/properties/p1/mode');
    expect(manualBlocksApi.remove).not.toHaveBeenCalled();
  });

  it('CalendarPage_ModeChangeBlock_NoWritePermission_ExplainsWithoutTheLink', async () => {
    renderPage({ permissions: ['booking.write'] });
    const details = await openTheBlock();
    // Whoever looks at the calendar is told why the nights are closed; "they open again if you cancel" is a way out they do not have.
    expect(within(details).getByTestId('mode-change-block')).toHaveTextContent(i18n.t('propertyMode.calendar.explanation'));
    expect(within(details).queryByText(i18n.t('propertyMode.calendar.reopen'))).not.toBeInTheDocument();
    expect(within(details).queryByTestId('mode-change-block-manage')).not.toBeInTheDocument();
    expect(within(details).queryByRole('button', { name: 'Elimina blocco' })).not.toBeInTheDocument();
  });

  it('CalendarPage_TheFormToCloseDates_NeverOffersTheModeChangeReason', async () => {
    vi.mocked(bookingsApi.getCalendar).mockResolvedValue(calendarResponse([]));
    renderPage();
    await screen.findByRole('button', { name: 'Giorno' });

    fireEvent.click(screen.getByRole('button', { name: 'Blocca date' }));
    const form = screen.getByRole('region', { name: 'Blocca date' });

    const options = within(within(form).getByLabelText('Motivo')).getAllByRole('option').map((option) => (option as HTMLOptionElement).value);
    expect(options).toEqual(['', 'Owner', 'Maintenance', 'Other']);
  });
});
