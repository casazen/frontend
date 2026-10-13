import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { decideFreeEvent } from '@/services/supplier-api';
import type { CalendarSyncStatus, PendingFreeEvent } from '@/types/supplier';
import { FreeEventsBanner } from '../free-events-banner';

vi.mock('@/services/supplier-api');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ALL_DAY: PendingFreeEvent = {
  id: 'ev-1',
  summary: 'Matrimonio TEST',
  isAllDay: true,
  recurring: false,
  occurrences: 1,
  nextStartUtc: '2026-10-14T22:00:00Z',
  nextEndUtc: '2026-10-15T22:00:00Z',
  firstSeenAt: '2026-10-13T08:00:00Z',
};

const TIMED_SERIES: PendingFreeEvent = {
  id: 'ev-2',
  summary: 'Corso TEST',
  isAllDay: false,
  recurring: true,
  occurrences: 8,
  nextStartUtc: '2026-10-16T07:00:00Z',
  nextEndUtc: '2026-10-16T09:30:00Z',
  firstSeenAt: '2026-10-13T08:00:00Z',
};

let client: QueryClient;

function renderBanner(items: PendingFreeEvent[] = [ALL_DAY, TIMED_SERIES], syncing = false) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FreeEventsBanner items={items} pendingCount={items.length} syncing={syncing} />
    </QueryClientProvider>,
  );
}

describe('FreeEventsBanner', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  it('render_PendingEvents_ShowsCountTitlesAndWhenInRomeTime', () => {
    renderBanner();

    expect(screen.getByRole('heading', { name: 'Hai 2 eventi del tuo calendario segnati Disponibile' })).toBeInTheDocument();
    const allDay = screen.getByTestId('free-event-ev-1');
    expect(allDay).toHaveTextContent('Matrimonio TEST');
    expect(allDay).toHaveTextContent('15 ott');
    expect(allDay).toHaveTextContent('Tutto il giorno');
    const series = screen.getByTestId('free-event-ev-2');
    expect(series).toHaveTextContent('09:00–11:30');
    expect(series).toHaveTextContent('ricorrente, 8 date');
    expect(screen.queryByTestId('free-events-syncing')).not.toBeInTheDocument();
  });

  it('render_Syncing_ShowsTheSyncInProgressNote', () => {
    renderBanner([ALL_DAY], true);

    expect(screen.getByTestId('free-events-syncing')).toHaveTextContent(i18n.t('supplier.freeEventsSyncing'));
  });

  it('markBusy_Clicked_SendsBusyWithoutAskingConfirmation', async () => {
    vi.mocked(decideFreeEvent).mockResolvedValue(undefined);
    renderBanner();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('supplier.freeEventsBusyAria', { title: 'Matrimonio TEST' }) }));

    await waitFor(() => expect(decideFreeEvent).toHaveBeenCalledWith('ev-1', 'Busy'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('supplier.freeEventsBusyDone')));
  });

  it('markAvailable_Clicked_AsksConfirmationAndSendsNothingUntilConfirmed', async () => {
    vi.mocked(decideFreeEvent).mockResolvedValue(undefined);
    renderBanner();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('supplier.freeEventsAvailableAria', { title: 'Corso TEST' }) }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(i18n.t('supplier.freeEventsConfirmConsequenceSeries'));
    expect(decideFreeEvent).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('supplier.freeEventsConfirmAction') }));

    await waitFor(() => expect(decideFreeEvent).toHaveBeenCalledWith('ev-2', 'Available'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('supplier.freeEventsAvailableDone')));
  });

  it('markAvailable_Cancelled_SendsNothing', async () => {
    renderBanner();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('supplier.freeEventsAvailableAria', { title: 'Matrimonio TEST' }) }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('shared.cancel') }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(decideFreeEvent).not.toHaveBeenCalled();
  });

  it('markBusy_ServerRejects_ShowsTheProblemMessageNotSuccess', async () => {
    vi.mocked(decideFreeEvent).mockRejectedValue(
      new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 404,
        statusText: '',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { status: 404, title: 'Not Found', code: 'free_event_not_found', detail: 'Evento non trovato.' },
      } as AxiosResponse),
    );
    renderBanner();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('supplier.freeEventsBusyAria', { title: 'Matrimonio TEST' }) }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('markAvailable_Succeeds_MarksTheSyncAsRunningAndRefreshesTheRightQueries', async () => {
    vi.mocked(decideFreeEvent).mockResolvedValue(undefined);
    renderBanner([ALL_DAY]);
    const status: CalendarSyncStatus = { calendarSyncType: 'ICalFeed', lastSyncStatus: 'Success' };
    client.setQueryData(['supplier', 'calendar-sync'], status);
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    fireEvent.click(screen.getByRole('button', { name: i18n.t('supplier.freeEventsAvailableAria', { title: 'Matrimonio TEST' }) }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: i18n.t('supplier.freeEventsConfirmAction') }));

    await waitFor(() => expect(decideFreeEvent).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(client.getQueryData<CalendarSyncStatus>(['supplier', 'calendar-sync'])?.lastSyncStatus).toBe('Syncing'),
    );
    const keys = invalidate.mock.calls.map((call) => (call[0]?.queryKey as string[])[1]);
    expect(keys).toEqual(expect.arrayContaining(['free-events', 'agenda', 'availability', 'dashboard', 'calendar-sync']));
  });
});
