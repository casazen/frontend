import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import {
  useSupplierAgendaCalendar,
  useSupplierAvailability,
  useUpdateSupplierAvailability,
} from '@/queries/use-supplier';
import { LATE_EVENING_UTC, NOON_UTC, freezeClock, withBrowserTimeZone } from '@/test/clock';
import type { SupplierAgendaCalendar } from '@/types/supplier';
import { SupplierAvailabilityPage } from '../supplier-availability-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/queries/use-supplier', () => ({
  useSupplierAvailability: vi.fn(),
  useSupplierAgendaCalendar: vi.fn(),
  useUpdateSupplierAvailability: vi.fn(),
}));

const mutateAsync = vi.fn();

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

function mockAgenda(agenda: SupplierAgendaCalendar, availabilityDates: { date: string; available: boolean }[] = []) {
  vi.mocked(useSupplierAgendaCalendar).mockReturnValue({
    data: agenda,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useSupplierAgendaCalendar>);
  vi.mocked(useSupplierAvailability).mockReturnValue({
    data: { dates: availabilityDates },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useSupplierAvailability>);
}

describe('SupplierAvailabilityPage today (QA-CLOCK-FE)', () => {
  withBrowserTimeZone('America/New_York');

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    mutateAsync.mockResolvedValue({ updated: 14 });
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
    mockAgenda(emptyAgenda('2026-09-25', '2026-10-08'), [{ date: '2026-09-25', available: false }]);

    render(
      <MemoryRouter>
        <SupplierAvailabilityPage />
      </MemoryRouter>,
    );

    expect(useSupplierAvailability).toHaveBeenCalledWith('2026-09-25', '2026-10-08');
    expect(useSupplierAgendaCalendar).toHaveBeenCalledWith('2026-09-25', '2026-10-08');
    expect(screen.queryByTestId('availability-2026-09-24')).not.toBeInTheDocument();
    expect(screen.getByTestId('availability-2026-09-25')).toHaveTextContent(i18n.t('supplier.notAvailable'));
    expect(screen.getByTestId('availability-2026-09-25')).toHaveTextContent('ven 25 set');
    expect(screen.getByTestId('availability-hours-2026-09-25')).toHaveTextContent('09:00–18:00');

    fireEvent.click(screen.getByRole('button', { name: i18n.t('supplier.saveAvailability') }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const dates = mutateAsync.mock.calls[0][0] as { date: string; available: boolean }[];
    expect(dates).toHaveLength(14);
    expect(dates[0]).toEqual({ date: '2026-09-25', available: false });
    expect(dates[13]).toEqual({ date: '2026-10-08', available: true });
  });

  it('SupplierAvailabilityPage_AtNoonUtc_StartsFromTheSameDate', () => {
    freezeClock(NOON_UTC);
    mockAgenda(emptyAgenda('2026-09-24', '2026-10-07'));

    render(
      <MemoryRouter>
        <SupplierAvailabilityPage />
      </MemoryRouter>,
    );

    expect(useSupplierAvailability).toHaveBeenCalledWith('2026-09-24', '2026-10-07');
    expect(screen.getByTestId('availability-2026-09-24')).toBeInTheDocument();
  });

  it('SupplierAvailabilityPage_LoadFails_ShowsAnErrorWithRetryNotAllDaysAvailable', async () => {
    freezeClock(NOON_UTC);
    const refetch = vi.fn();
    vi.mocked(useSupplierAvailability).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('boom'),
      refetch,
    } as unknown as ReturnType<typeof useSupplierAvailability>);
    vi.mocked(useSupplierAgendaCalendar).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSupplierAgendaCalendar>);

    render(
      <MemoryRouter>
        <SupplierAvailabilityPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('supplier-availability-error')).toHaveTextContent(i18n.t('supplier.availabilityLoadError'));
    expect(screen.queryByTestId('availability-2026-09-24')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.errorState.retry') }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('SupplierAvailabilityPage_CalendarBusyDay_ShowsEventAndClosedByCalendar', () => {
    freezeClock(NOON_UTC);
    const agenda = emptyAgenda('2026-09-24', '2026-10-07');
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

    render(
      <MemoryRouter>
        <SupplierAvailabilityPage />
      </MemoryRouter>,
    );

    const card = screen.getByTestId('availability-2026-09-25');
    expect(card).toHaveTextContent(i18n.t('supplier.notAvailable'));
    expect(card).toHaveTextContent(i18n.t('supplier.closedByCalendar'));
    expect(screen.getByTestId('availability-events-2026-09-25')).toHaveTextContent('busy - TEST');
    expect(screen.getByTestId('availability-event-calendar')).toHaveTextContent(i18n.t('supplier.allDay'));
  });
});
