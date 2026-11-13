import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { calendarChangesApi } from '@/api/calendar-changes.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import type { CalendarChange } from '@/types/calendar-changes.types';
import { CalendarChangeStatus } from '../calendar-change-status';

vi.mock('@/api/calendar-changes.api', () => ({ calendarChangesApi: { apply: vi.fn(), get: vi.fn(), retry: vi.fn(), list: vi.fn(), preview: vi.fn() } }));

const change = (changes: Partial<CalendarChange> = {}): CalendarChange => ({
  id: 'c1',
  kind: 'DayRules',
  state: 'Queued',
  requestedAt: '2026-09-12T10:00:00Z',
  propertyCount: 1,
  dayCount: 3,
  quotaUnitsEstimated: 1,
  properties: [{ propertyId: 'p1', state: 'Pending', chunkCount: 1 }],
  ...changes,
});

function statusError(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, { status, statusText: '', headers: {}, config, data: {} });
}

function renderStatus(canRetry = true, connector = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, octorateConnector: connector }, isLoading: false }}>
        <CalendarChangeStatus propertyName={(id) => (id === 'p1' ? 'Villa Mare' : 'Casa Lago')} canRetry={canRetry} />
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
  return client;
}

describe('CalendarChangeStatus (E08/F05/US03/T03, NF-36)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('CalendarChangeStatus_AChangeBeingSent_SaysSo', async () => {
    vi.mocked(calendarChangesApi.list).mockResolvedValue([change({ state: 'Sending' })]);
    renderStatus();

    expect(await screen.findByTestId('calendar-change-status-waiting')).toHaveTextContent('1 modifica è in invio al tuo channel manager.');
    expect(screen.getByTestId('calendar-change-status')).toHaveAttribute('data-state', 'waiting');
  });

  it('CalendarChangeStatus_ConnectorOff_AsksForNothingAndSaysNothingOfTheChannelManager', async () => {
    // Changes left waiting or failed from when the connector was on: with it off nothing is sent there, so nothing is followed, asked or said.
    vi.mocked(calendarChangesApi.list).mockResolvedValue([change({ state: 'Sending' }), change({ id: 'c2', state: 'Failed', properties: [{ propertyId: 'p1', state: 'Failed', chunkCount: 1 }] })]);
    renderStatus(true, false);

    await act(async () => {
      await Promise.resolve();
    });
    expect(calendarChangesApi.list).not.toHaveBeenCalled();
    expect(screen.queryByTestId('calendar-change-status')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/channel manager/i);
  });

  it('CalendarChangeStatus_AChangeThatWasNotSent_SaysSoWithRetry_AndTheListIsOneClickAway', async () => {
    const failed = change({ id: 'c2', state: 'Failed', properties: [{ propertyId: 'p1', state: 'Failed', errorCode: 'octorate_unavailable', chunkCount: 1 }] });
    vi.mocked(calendarChangesApi.list).mockResolvedValue([failed, change({ id: 'c3', state: 'Confirmed', properties: [{ propertyId: 'p2', state: 'Confirmed', chunkCount: 1 }] })]);
    vi.mocked(calendarChangesApi.retry).mockResolvedValue(change({ id: 'c2', state: 'Queued' }));
    renderStatus();

    expect(await screen.findByTestId('calendar-change-status-failed')).toHaveTextContent('1 modifica non è stata inviata.');
    expect(screen.queryByTestId('calendar-change-list')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('calendar-change-status-toggle'));
    const rows = screen.getAllByTestId('calendar-change-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByTestId('calendar-change-row-state')).toHaveTextContent('Non inviata');
    expect(within(rows[0]).getByTestId('calendar-change-row-reason')).toHaveTextContent('Il channel manager non ha risposto');
    expect(rows[0]).toHaveTextContent('Villa Mare');
    expect(within(rows[1]).getByTestId('calendar-change-row-state')).toHaveTextContent('Confermata dal tuo channel manager');

    fireEvent.click(screen.getByTestId('calendar-change-status-retry'));
    await waitFor(() => expect(calendarChangesApi.retry).toHaveBeenCalledWith('c2'));
  });

  it('CalendarChangeStatus_EverythingDelivered_DisappearsAndSaysNothing', async () => {
    vi.mocked(calendarChangesApi.list).mockResolvedValue([change({ state: 'Sent' }), change({ id: 'c2', state: 'Applied' })]);
    renderStatus();

    await waitFor(() => expect(calendarChangesApi.list).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('calendar-change-status')).not.toBeInTheDocument());
  });

  it('CalendarChangeStatus_AListThatCannotBeRead_IsNeverTakenForAllDelivered', async () => {
    vi.mocked(calendarChangesApi.list).mockRejectedValue(statusError(500));
    renderStatus();

    const line = await screen.findByTestId('calendar-change-status');
    expect(line).toHaveAttribute('data-state', 'unreadable');
    expect(line).toHaveTextContent('Non riusciamo a leggere le modifiche inviate al tuo channel manager.');
  });

  it('CalendarChangeStatus_ACallerWhoMayNotReadTheList_GetsNothingAndNoError', async () => {
    vi.mocked(calendarChangesApi.list).mockRejectedValue(statusError(403));
    renderStatus();

    await waitFor(() => expect(calendarChangesApi.list).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('calendar-change-status')).not.toBeInTheDocument());
  });

  it('CalendarChangeStatus_WithoutTheRightToWrite_OffersNoRetry', async () => {
    vi.mocked(calendarChangesApi.list).mockResolvedValue([change({ state: 'Failed', properties: [{ propertyId: 'p1', state: 'Failed', chunkCount: 1 }] })]);
    renderStatus(false);

    await screen.findByTestId('calendar-change-status-failed');
    fireEvent.click(screen.getByTestId('calendar-change-status-toggle'));
    expect(screen.queryByTestId('calendar-change-status-retry')).not.toBeInTheDocument();
    expect(screen.queryByTestId('calendar-change-row-retry')).not.toBeInTheDocument();
  });

  it('CalendarChangeStatus_TheButtonsStayOffWhileARetryIsOnItsWay', async () => {
    vi.mocked(calendarChangesApi.list).mockResolvedValue([change({ state: 'Failed', properties: [{ propertyId: 'p1', state: 'Failed', chunkCount: 1 }] })]);
    vi.mocked(calendarChangesApi.retry).mockReturnValue(new Promise(() => undefined));
    renderStatus();

    fireEvent.click(await screen.findByTestId('calendar-change-status-retry'));
    fireEvent.click(screen.getByTestId('calendar-change-status-toggle'));
    await waitFor(() => expect(screen.getByTestId('calendar-change-row-retry')).toBeDisabled());
    expect(screen.getByTestId('calendar-change-status-retry')).toBeDisabled();
  });
});
