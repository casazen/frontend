import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { fetchCalendarSyncStatus, setIcalFeed, syncSupplierCalendarNow } from '@/services/supplier-api';
import type { CalendarSyncStatus } from '@/types/supplier';
import { supplierSyncRefetchInterval } from '@/queries/use-supplier';
import { SupplierCalendarSyncPage } from '../supplier-calendar-sync-page';

vi.mock('@/services/supplier-api');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const FEED_URL = 'https://calendar.google.com/calendar/ical/x/basic.ics';

const syncing: CalendarSyncStatus = {
  calendarSyncType: 'ICalFeed',
  icalFeedUrl: FEED_URL,
  calendarLastSyncAt: null,
  lastSyncStatus: 'Syncing',
  calendarSyncErrorCode: null,
  calendarSyncError: null,
};

const synced: CalendarSyncStatus = { ...syncing, lastSyncStatus: 'Success', calendarLastSyncAt: '2026-09-25T08:00:00Z' };

const notLinked: CalendarSyncStatus = {
  calendarSyncType: 'None',
  icalFeedUrl: null,
  calendarLastSyncAt: null,
  lastSyncStatus: 'None',
  calendarSyncErrorCode: null,
  calendarSyncError: null,
};

function problem(status: number, code: string, detail: string): AxiosError {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { status, title: 'One or more errors occurred.', code, detail },
  } as AxiosResponse);
}

let queryClient: QueryClient;

function renderPage() {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SupplierCalendarSyncPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SupplierCalendarSyncPage (SU-15)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    vi.useRealTimers();
    queryClient?.clear();
  });

  it('render_SyncQueued_ShowsInProgressNeverSyncedAndPollsUntilTheJobHasRun', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(fetchCalendarSyncStatus).mockResolvedValueOnce(syncing).mockResolvedValue(synced);

    renderPage();

    expect(await screen.findByText('Sincronizzazione in corso…')).toBeInTheDocument();
    expect(screen.queryByText('Sincronizzato')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sincronizza ora' })).toBeDisabled();

    await act(() => vi.advanceTimersByTimeAsync(3_000));

    await waitFor(() => expect(screen.getByText('Sincronizzato')).toBeInTheDocument());
    expect(screen.queryByText('Sincronizzazione in corso…')).not.toBeInTheDocument();
    const reads = vi.mocked(fetchCalendarSyncStatus).mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(fetchCalendarSyncStatus).toHaveBeenCalledTimes(reads);
  });

  it('saveUrl_Accepted_SaysTheSyncStartedAndShowsItInProgress', async () => {
    vi.mocked(fetchCalendarSyncStatus).mockResolvedValue(notLinked);
    vi.mocked(setIcalFeed).mockResolvedValue(syncing);

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('supplier.pasteIcalUrl') }));
    fireEvent.change(screen.getByLabelText(i18n.t('supplier.icalFeedUrlLabel')), { target: { value: ` ${FEED_URL} ` } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('supplier.saveAndSync') }));

    await waitFor(() => expect(setIcalFeed).toHaveBeenCalledTimes(1));
    expect(vi.mocked(setIcalFeed).mock.calls[0][0]).toBe(FEED_URL);
    expect(toast.success).toHaveBeenCalledWith('Sincronizzazione avviata: il calendario si aggiorna tra pochi istanti');
    expect(await screen.findByText('Sincronizzazione in corso…')).toBeInTheDocument();
    expect(screen.queryByText('Sincronizzato')).not.toBeInTheDocument();
  });

  it('saveUrl_InvalidUrl_ShowsTheServerMessage', async () => {
    vi.mocked(fetchCalendarSyncStatus).mockResolvedValue(notLinked);
    vi.mocked(setIcalFeed).mockRejectedValue(problem(400, 'ical_invalid_url', 'Usa un link https pubblico.'));

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('supplier.pasteIcalUrl') }));
    fireEvent.change(screen.getByLabelText(i18n.t('supplier.icalFeedUrlLabel')), { target: { value: 'http://10.0.0.1/x' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('supplier.saveAndSync') }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('syncNow_Click_QueuesAndShowsInProgress', async () => {
    vi.mocked(fetchCalendarSyncStatus).mockResolvedValue(synced);
    vi.mocked(syncSupplierCalendarNow).mockResolvedValue(syncing);

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Sincronizza ora' }));

    await waitFor(() => expect(syncSupplierCalendarNow).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Sincronizzazione in corso…')).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Sincronizzazione avviata: il calendario si aggiorna tra pochi istanti');
  });

  it('render_LastSyncFailed_ShowsTheLocalizedErrorNotSynced', async () => {
    vi.mocked(fetchCalendarSyncStatus).mockResolvedValue({
      ...synced,
      lastSyncStatus: 'Failure',
      calendarSyncErrorCode: 'ical_unreachable',
      calendarSyncError: 'Non è stato possibile scaricare il calendario.',
    });

    renderPage();

    expect(await screen.findByText('Non è stato possibile scaricare il calendario.')).toBeInTheDocument();
    expect(screen.queryByText('Sincronizzato')).not.toBeInTheDocument();
  });

  it('render_LoadError_ShowsErrorAndRetry', async () => {
    vi.mocked(fetchCalendarSyncStatus).mockRejectedValueOnce(problem(500, 'internal', 'x')).mockResolvedValue(synced);

    renderPage();

    expect(await screen.findByText('Impossibile caricare lo stato del calendario.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByText('Sincronizzato')).toBeInTheDocument();
  });
});

describe('supplierSyncRefetchInterval (SU-15)', () => {
  it('supplierSyncRefetchInterval_NotSyncing_DoesNotPoll', () => {
    expect(supplierSyncRefetchInterval({ state: { data: synced } })).toBe(false);
    expect(supplierSyncRefetchInterval({ state: { data: undefined } })).toBe(false);
  });

  it('supplierSyncRefetchInterval_Syncing_PollsFastThenSlower', () => {
    const query = { state: { data: syncing } };
    const start = 1_000_000;

    expect(supplierSyncRefetchInterval(query, start)).toBe(3_000);
    expect(supplierSyncRefetchInterval(query, start + 59_000)).toBe(3_000);
    expect(supplierSyncRefetchInterval(query, start + 61_000)).toBe(15_000);
  });
});
