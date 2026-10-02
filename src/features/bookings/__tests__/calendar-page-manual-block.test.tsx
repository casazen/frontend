import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { bookingsApi } from '@/api/bookings.api';
import { manualBlocksApi } from '@/api/manual-blocks.api';
import { useProperties } from '@/queries/use-properties';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import { freezeClock, withBrowserTimeZone } from '@/test/clock';
import type { CalendarItemDto, CalendarResponseDto, ManualBlockDto } from '@/types/calendar.types';
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

// Dates the host closed for maintenance today (PC-09).
const MAINTENANCE_BLOCK: CalendarItemDto = {
  type: 'ical-block',
  id: 'mb1',
  propertyId: 'p1',
  startDate: '2026-09-30T00:00:00',
  endDate: '2026-10-02T00:00:00',
  startDateUtc: '2026-09-30T00:00:00Z',
  endDateUtc: '2026-10-02T00:00:00Z',
  summary: 'Cambio caldaia',
  channel: null,
  feedLabel: null,
  blockSource: 'Manual',
  blockReason: 'Maintenance',
  feedId: null,
  bookingId: null,
  convertible: false,
};

function calendarResponse(items: CalendarItemDto[]): CalendarResponseDto {
  return { timezone: 'Europe/Rome', utcOffsetMinutes: 120, bookings: [], items };
}

function problemError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  });
}

function renderPage(permissions: string[] = ['property.write', 'booking.write']) {
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

function openForm() {
  fireEvent.click(screen.getByRole('button', { name: 'Blocca date' }));
  return screen.getByRole('region', { name: 'Blocca date' });
}

async function openMaintenanceBlock() {
  fireEvent.click(screen.getByRole('button', { name: 'Giorno' }));
  fireEvent.click(await screen.findByText('Manutenzione'));
  return screen.getByRole('region', { name: 'Date chiuse: Manutenzione' });
}

describe('CalendarPage manual blocks (PC-09)', () => {
  withBrowserTimeZone('Europe/Rome');

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    freezeClock('2026-09-30T10:00:00Z');
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

  it('BloccaDate_ValidForm_SendsStayDatesReasonAndNoteAndClosesTheForm', async () => {
    vi.mocked(manualBlocksApi.create).mockResolvedValue({ id: 'mb9' } as ManualBlockDto);
    renderPage();
    await screen.findByRole('button', { name: 'Giorno' });

    const form = openForm();
    // From today (Rome) by default, one night.
    expect(within(form).getByLabelText('Dalla notte del')).toHaveValue('2026-09-30');
    expect(within(form).getByLabelText('Di nuovo libero dal')).toHaveValue('2026-10-01');
    fireEvent.change(within(form).getByLabelText('Dalla notte del'), { target: { value: '2026-10-10' } });
    fireEvent.change(within(form).getByLabelText('Di nuovo libero dal'), { target: { value: '2026-10-13' } });
    expect(within(form).getByTestId('manual-block-nights')).toHaveTextContent('3 notti bloccate');
    fireEvent.change(within(form).getByLabelText('Motivo'), { target: { value: 'Owner' } });
    fireEvent.change(within(form).getByLabelText('Nota (facoltativa)'), { target: { value: '  Ferie  ' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Blocca date' }));

    await waitFor(() =>
      expect(manualBlocksApi.create).toHaveBeenCalledWith('p1', {
        startDate: '2026-10-10',
        endDate: '2026-10-13',
        reason: 'Owner',
        note: 'Ferie',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Blocca date' })).not.toBeInTheDocument());
    // The calendar of the range is asked again with the new block.
    await waitFor(() => expect(bookingsApi.getCalendar).toHaveBeenCalledTimes(2));
  });

  it('BloccaDate_MissingReasonOrEndBeforeStart_ShowsErrorsAndSendsNothing', async () => {
    renderPage();
    await screen.findByRole('button', { name: 'Giorno' });

    const form = openForm();
    fireEvent.change(within(form).getByLabelText('Di nuovo libero dal'), { target: { value: '2026-09-30' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Blocca date' }));

    expect(await within(form).findByText('Scegli il motivo del blocco.')).toBeInTheDocument();
    expect(within(form).getByText('La data di fine deve essere successiva alla prima notte.')).toBeInTheDocument();
    expect(within(form).getByLabelText('Motivo')).toHaveAttribute('aria-invalid', 'true');
    expect(manualBlocksApi.create).not.toHaveBeenCalled();
  });

  it('BloccaDate_NightTakenByABooking_ShowsTheConflictInTheFormAndKeepsIt', async () => {
    vi.mocked(manualBlocksApi.create).mockRejectedValue(
      problemError(409, { code: 'calendar_block_overlaps_booking', detail: 'server text' }),
    );
    renderPage();
    await screen.findByRole('button', { name: 'Giorno' });

    const form = openForm();
    fireEvent.change(within(form).getByLabelText('Motivo'), { target: { value: 'Maintenance' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Blocca date' }));

    expect(await within(form).findByTestId('manual-block-error')).toHaveTextContent(
      'Una prenotazione occupa già una di queste notti: annullala o scegli altre date.',
    );
    expect(screen.getByRole('region', { name: 'Blocca date' })).toBeInTheDocument();
  });

  it('ManualBlock_Opened_ShowsReasonNoteAndRemovesItAfterConfirmation', async () => {
    vi.mocked(bookingsApi.getCalendar).mockResolvedValue(calendarResponse([MAINTENANCE_BLOCK]));
    vi.mocked(manualBlocksApi.remove).mockResolvedValue(undefined);
    renderPage();

    const details = await openMaintenanceBlock();
    expect(within(details).getByText('Nota: Cambio caldaia')).toBeInTheDocument();
    // Not an OTA reservation: no "Crea soggiorno OTA".
    expect(within(details).queryByRole('button', { name: 'Crea soggiorno OTA' })).not.toBeInTheDocument();

    fireEvent.click(within(details).getByRole('button', { name: 'Elimina blocco' }));
    expect(manualBlocksApi.remove).not.toHaveBeenCalled();
    fireEvent.click(within(details).getByRole('button', { name: 'Elimina' }));

    await waitFor(() => expect(manualBlocksApi.remove).toHaveBeenCalledWith('p1', 'mb1'));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Date chiuse: Manutenzione' })).not.toBeInTheDocument(),
    );
  });

  it('ManualBlock_RemoveFails_ShowsTheErrorAndKeepsThePanel', async () => {
    vi.mocked(bookingsApi.getCalendar).mockResolvedValue(calendarResponse([MAINTENANCE_BLOCK]));
    vi.mocked(manualBlocksApi.remove).mockRejectedValue(problemError(404, { code: 'calendar_block_not_found' }));
    renderPage();

    const details = await openMaintenanceBlock();
    fireEvent.click(within(details).getByRole('button', { name: 'Elimina blocco' }));
    fireEvent.click(within(details).getByRole('button', { name: 'Elimina' }));

    expect(await within(details).findByRole('alert')).toHaveTextContent('Il blocco non esiste più: aggiorna il calendario.');
    expect(screen.getByRole('region', { name: 'Date chiuse: Manutenzione' })).toBeInTheDocument();
  });

  it('ManualBlocks_WithoutPropertyWrite_CanBeSeenButNotCreatedOrRemoved', async () => {
    vi.mocked(bookingsApi.getCalendar).mockResolvedValue(calendarResponse([MAINTENANCE_BLOCK]));
    renderPage(['booking.write']);

    const details = await openMaintenanceBlock();

    expect(screen.queryByRole('button', { name: 'Blocca date' })).not.toBeInTheDocument();
    expect(within(details).queryByRole('button', { name: 'Elimina blocco' })).not.toBeInTheDocument();
    expect(within(details).getByText("Solo chi può modificare l'immobile può eliminare il blocco.")).toBeInTheDocument();
  });
});
