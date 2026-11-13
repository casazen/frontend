import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { calendarChangesApi } from '@/api/calendar-changes.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import { CHANGE_POLL_MS, CHANGE_WATCH_MS } from '@/queries/use-calendar-changes';
import type { CalendarChange } from '@/types/calendar-changes.types';
import { CalendarChangeLines } from '../calendar-change-lines';

vi.mock('@/api/calendar-changes.api', () => ({ calendarChangesApi: { apply: vi.fn(), get: vi.fn(), retry: vi.fn(), list: vi.fn(), preview: vi.fn() } }));

const WAITING: CalendarChange = {
  id: 'c1',
  kind: 'DayRules',
  state: 'Queued',
  requestedAt: '2026-09-12T10:00:00Z',
  propertyCount: 1,
  dayCount: 3,
  quotaUnitsEstimated: 1,
  properties: [{ propertyId: 'p1', state: 'Pending', chunkCount: 1 }],
};

function statusError(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, { status, statusText: '', headers: {}, config, data: {} });
}

function renderLines(change: CalendarChange = WAITING, permissions: string[] = ['property.read', 'property.write'], connector = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const workspace = { hasPermission: (context: string, permission: string) => context === 'short-rent' && permissions.includes(permission) } as unknown as WorkspaceContextValue;
  render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, octorateConnector: connector }, isLoading: false }}>
        <WorkspaceContext.Provider value={workspace}>
          <CalendarChangeLines change={change} propertyName={() => 'Villa Mare'} />
        </WorkspaceContext.Provider>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
}

const state = () => screen.getByTestId('calendar-change-property').getAttribute('data-state');

describe('CalendarChangeLines: following a change (E08/F05/US03/T02, T03, NF-36)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('CalendarChangeLines_AWaitingChange_IsFollowedEveryFiveSecondsAndTurnsIntoItsOutcome', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.mocked(calendarChangesApi.get).mockResolvedValue(WAITING);
    renderLines();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(state()).toBe('waiting');

    vi.mocked(calendarChangesApi.get).mockResolvedValue({ ...WAITING, state: 'Sent', properties: [{ propertyId: 'p1', state: 'Accepted', chunkCount: 1 }] });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHANGE_POLL_MS + 100);
    });

    expect(state()).toBe('accepted');
  });

  it('CalendarChangeLines_NoEndlessPolling_AfterTheTimeItStopsAndSaysNoAnswerWithCheckAgain', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.mocked(calendarChangesApi.get).mockResolvedValue(WAITING);
    renderLines();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHANGE_WATCH_MS + CHANGE_POLL_MS * 2);
    });

    // The screen has stopped asking by itself: neutral words (not a failure) and a button.
    expect(state()).toBe('noAnswer');
    expect(screen.getByTestId('calendar-change-property')).toHaveTextContent('non ha ancora risposto');
    const calls = vi.mocked(calendarChangesApi.get).mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHANGE_POLL_MS * 6);
    });
    expect(vi.mocked(calendarChangesApi.get).mock.calls.length).toBe(calls);

    // "Check again" asks once more and the screen follows the change for a new while.
    await act(async () => {
      fireEvent.click(screen.getByTestId('calendar-change-check-again'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(vi.mocked(calendarChangesApi.get).mock.calls.length).toBe(calls + 1);
    expect(state()).toBe('waiting');
  });

  it('CalendarChangeLines_ARetryLongAfterTheScreenOpened_IsFollowedFromTheRetry_NotToldAsNoAnswer', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const failed: CalendarChange = { ...WAITING, state: 'Failed', properties: [{ propertyId: 'p1', state: 'Failed', errorCode: 'octorate_unavailable', chunkCount: 1 }] };
    vi.mocked(calendarChangesApi.get).mockResolvedValue(failed);
    renderLines(failed);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(state()).toBe('failed');

    // The host reads the failure and, much later than the three minutes of the window, sends it again: the change waits again and is followed from now.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHANGE_WATCH_MS + CHANGE_POLL_MS * 2);
    });
    vi.mocked(calendarChangesApi.retry).mockResolvedValue(WAITING);
    vi.mocked(calendarChangesApi.get).mockResolvedValue(WAITING);
    await act(async () => {
      fireEvent.click(screen.getByTestId('calendar-change-retry'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(calendarChangesApi.retry).toHaveBeenCalledWith('c1');
    expect(state()).toBe('waiting');

    vi.mocked(calendarChangesApi.get).mockResolvedValue({ ...WAITING, state: 'Sent', properties: [{ propertyId: 'p1', state: 'Accepted', chunkCount: 1 }] });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHANGE_POLL_MS + 100);
    });
    expect(state()).toBe('accepted');
  });

  it('CalendarChangeLines_A404_IsNotFound_EvenThoughTheCacheHoldsTheChange', async () => {
    vi.mocked(calendarChangesApi.get).mockRejectedValue(statusError(404));
    renderLines({ ...WAITING, state: 'Sent', properties: [{ propertyId: 'p1', state: 'Accepted', chunkCount: 1 }] });

    await waitFor(() => expect(state()).toBe('notFound'));
    expect(screen.getByTestId('calendar-change-property')).toHaveTextContent('Non troviamo più questa modifica.');
  });

  it('CalendarChangeLines_AReadThatFails_IsSaidAsUnreadable_NeverAsDone', async () => {
    vi.mocked(calendarChangesApi.get).mockRejectedValue(statusError(500));
    renderLines();

    await waitFor(() => expect(state()).toBe('unreadable'));
    expect(screen.getByTestId('calendar-change-check-again')).toBeInTheDocument();
  });

  it('CalendarChangeLines_ConnectorOff_AsksForNothingAndSaysOnlySavedInCasaZen', async () => {
    // Whatever the change says (a waiting one left from when the connector was on): with the connector off nothing is sent to the channel manager, so nothing is followed or said of it.
    renderLines(WAITING, ['property.read', 'property.write'], false);

    await act(async () => {
      await Promise.resolve();
    });
    expect(calendarChangesApi.get).not.toHaveBeenCalled();
    expect(screen.getByTestId('calendar-change-saved')).toHaveTextContent('Salvato in CasaZen');
    expect(screen.queryByTestId('calendar-change-property')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/channel manager/i);
  });

  it('CalendarChangeLines_WithoutTheRightToRead_AsksForNothing', async () => {
    renderLines(WAITING, ['property.write']);

    await act(async () => {
      await Promise.resolve();
    });
    expect(calendarChangesApi.get).not.toHaveBeenCalled();
    // Nothing is claimed about a progress that cannot be followed, and no button asks for a read the caller may not make.
    expect(state()).toBe('noAnswer');
    expect(screen.queryByTestId('calendar-change-check-again')).not.toBeInTheDocument();
  });
});
