import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import {
  useCalendarSyncStatus,
  useDecideFreeEvent,
  usePendingFreeEvents,
  useSupplierAgendaCalendar,
  useSupplierConflicts,
  useSupplierHours,
  useUpdateSupplierAvailability,
} from '@/queries/use-supplier';
import { LATE_EVENING_UTC, NOON_UTC, freezeClock, withBrowserTimeZone } from '@/test/clock';
import type { SupplierAgendaCalendar } from '@/types/supplier';
import { SupplierAvailabilityPage } from '../supplier-availability-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/queries/use-supplier', () => ({
  useCalendarSyncStatus: vi.fn(),
  useDecideFreeEvent: vi.fn(),
  usePendingFreeEvents: vi.fn(),
  useSupplierAgendaCalendar: vi.fn(),
  useSupplierConflicts: vi.fn(),
  useSupplierHours: vi.fn(),
  useUpdateSupplierAvailability: vi.fn(),
}));

const mutateAsync = vi.fn();

function mockFreeEvents(pendingCount = 0, items: unknown[] = [], extra: Record<string, unknown> = {}) {
  vi.mocked(usePendingFreeEvents).mockReturnValue({
    data: { items, pendingCount },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...extra,
  } as unknown as ReturnType<typeof usePendingFreeEvents>);
  vi.mocked(useDecideFreeEvent).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useDecideFreeEvent>);
  vi.mocked(useCalendarSyncStatus).mockReturnValue({
    data: { calendarSyncType: 'ICalFeed', lastSyncStatus: 'Success' },
  } as unknown as ReturnType<typeof useCalendarSyncStatus>);
}

function emptyAgenda(from: string, to: string): SupplierAgendaCalendar {
  return {
    from,
    to,
    timeZone: 'Europe/Rome',
    workingHours: [
      { weekday: 'Monday', bands: [{ startMinute: 540, endMinute: 1080 }] },
      { weekday: 'Tuesday', bands: [{ startMinute: 540, endMinute: 1080 }] },
      { weekday: 'Wednesday', bands: [{ startMinute: 540, endMinute: 1080 }] },
      { weekday: 'Thursday', bands: [{ startMinute: 540, endMinute: 1080 }] },
      { weekday: 'Friday', bands: [{ startMinute: 540, endMinute: 1080 }] },
      { weekday: 'Saturday', bands: [] },
      { weekday: 'Sunday', bands: [] },
    ],
    closedDays: [],
    timeOff: [],
    blocks: [],
    requests: [],
  };
}

function mockAgenda(agenda: SupplierAgendaCalendar) {
  vi.mocked(useSupplierAgendaCalendar).mockReturnValue({
    data: agenda,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useSupplierAgendaCalendar>);
  vi.mocked(useSupplierHours).mockReturnValue({
    data: { days: agenda.workingHours, configuredAt: '2026-09-01T10:00:00Z' },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useSupplierHours>);
}

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/app/supplier/availability${search}`]}>
      <SupplierAvailabilityPage />
    </MemoryRouter>,
  );
}

describe('SupplierAvailabilityPage today (QA-CLOCK-FE)', () => {
  withBrowserTimeZone('America/New_York');

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    mutateAsync.mockResolvedValue({ updated: 1 });
    mockFreeEvents();
    // The check of the jobs to come (SP-03b) finds nothing wrong.
    vi.mocked(useSupplierConflicts).mockReturnValue({
      data: { from: '2026-09-24', to: '2026-10-24', timeZone: 'Europe/Rome', items: [], total: 0, truncated: false, limit: 200 },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useSupplierConflicts>);
    vi.mocked(useUpdateSupplierAvailability).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateSupplierAvailability>);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('SupplierAvailabilityPage_At2330UtcOf24September_StartsFromTodayInRome', async () => {
    freezeClock(LATE_EVENING_UTC);
    const agenda = emptyAgenda('2026-09-25', '2026-09-25');
    agenda.closedDays = [{ date: '2026-09-25', source: 'Manual' }];
    mockAgenda(agenda);

    renderPage('?vista=giorno');

    expect(useSupplierAgendaCalendar).toHaveBeenCalledWith('2026-09-25', '2026-09-25');
    expect(screen.getByTestId('availability-2026-09-25')).toHaveTextContent(i18n.t('supplier.agenda.state.closed'));
    expect(screen.getByTestId('availability-hours-2026-09-25')).toHaveTextContent('09:00–18:00');

    fireEvent.click(screen.getByRole('button', { name: i18n.t('supplier.agenda.reopen') }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith([{ date: '2026-09-25', available: true }]);
  });

  it('SupplierAvailabilityPage_AtNoonUtc_ShowsTheWeekOfTheSameDate', () => {
    freezeClock(NOON_UTC);
    mockAgenda(emptyAgenda('2026-09-21', '2026-09-27'));

    renderPage();

    expect(useSupplierAgendaCalendar).toHaveBeenCalledWith('2026-09-21', '2026-09-27');
    expect(screen.getByTestId('availability-2026-09-21')).toBeInTheDocument();
    expect(screen.getByTestId('availability-2026-09-27')).toBeInTheDocument();
    expect(screen.getByTestId('availability-hours-2026-09-24')).toHaveTextContent('09:00–18:00');
  });

  it('SupplierAvailabilityPage_LoadFails_ShowsAnErrorWithRetryNotAnEmptyAgenda', () => {
    freezeClock(NOON_UTC);
    const refetch = vi.fn();
    vi.mocked(useSupplierAgendaCalendar).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('boom'),
      refetch,
    } as unknown as ReturnType<typeof useSupplierAgendaCalendar>);
    vi.mocked(useSupplierHours).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSupplierHours>);

    renderPage();

    expect(screen.getByTestId('supplier-availability-error')).toHaveTextContent(i18n.t('supplier.availabilityLoadError'));
    expect(screen.queryByTestId('availability-2026-09-24')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.errorState.retry') }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('SupplierAvailabilityPage_CalendarBusyDay_ShowsEventAndClosedByCalendar', () => {
    freezeClock(NOON_UTC);
    const agenda = emptyAgenda('2026-09-25', '2026-09-25');
    agenda.closedDays = [{ date: '2026-09-25', source: 'ICalFeed' }];
    agenda.blocks = [
      {
        id: 'b1',
        kind: 'External',
        source: 'ICalFeed',
        startUtc: '2026-09-24T22:00:00Z',
        endUtc: '2026-09-25T22:00:00Z',
        label: 'busy - TEST',
        createdAt: '2026-09-24T10:00:00Z',
      },
    ];
    mockAgenda(agenda);

    renderPage('?vista=giorno&data=2026-09-25');

    expect(screen.getByTestId('availability-2026-09-25')).toHaveTextContent(i18n.t('supplier.agenda.state.closedByCalendar'));
    expect(screen.getByTestId('availability-events-2026-09-25')).toHaveTextContent('busy - TEST');
    expect(screen.getByTestId('availability-event-calendar')).toHaveTextContent(i18n.t('supplier.allDay'));
  });

  it('SupplierAvailabilityPage_PendingFreeEvent_LabelsTheHeldDaysAndShowsTheBanner', () => {
    freezeClock(NOON_UTC);
    mockAgenda(emptyAgenda('2026-09-21', '2026-09-27'));
    mockFreeEvents(1, [
      {
        id: 'fe1',
        summary: 'Compleanno TEST',
        isAllDay: true,
        recurring: false,
        occurrences: 1,
        nextStartUtc: '2026-09-24T22:00:00Z',
        nextEndUtc: '2026-09-25T22:00:00Z',
        firstSeenAt: '2026-09-24T10:00:00Z',
      },
    ]);

    renderPage();

    expect(screen.getByTestId('free-events-banner')).toBeInTheDocument();
    expect(screen.getByTestId('availability-pending-2026-09-25')).toHaveTextContent(i18n.t('supplier.freeEventPendingBadge'));
    expect(screen.queryByTestId('availability-pending-2026-09-24')).not.toBeInTheDocument();
    expect(screen.queryByTestId('availability-pending-2026-09-26')).not.toBeInTheDocument();
  });

  it('SupplierAvailabilityPage_NoPendingFreeEvents_ShowsNoBannerNorLabels', () => {
    freezeClock(NOON_UTC);
    mockAgenda(emptyAgenda('2026-09-21', '2026-09-27'));

    renderPage();

    expect(screen.queryByTestId('free-events-banner')).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('supplier.freeEventPendingBadge'))).not.toBeInTheDocument();
  });

  it('SupplierAvailabilityPage_FreeEventsLoadFails_ShowsAWarningWithRetryAndKeepsTheAgenda', () => {
    freezeClock(NOON_UTC);
    mockAgenda(emptyAgenda('2026-09-21', '2026-09-27'));
    const refetch = vi.fn();
    mockFreeEvents(0, [], { data: undefined, isError: true, refetch });

    renderPage();

    expect(screen.getByTestId('free-events-error')).toHaveTextContent(i18n.t('supplier.freeEventsLoadError'));
    expect(screen.getByTestId('availability-2026-09-24')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('supplier.retry') }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
