import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { scheduledMessagesApi } from '@/api/scheduled-messages.api';
import type { ScheduledMessage } from '@/types';
import { SCHEDULED_MESSAGES_POLL_MS, SCHEDULED_MESSAGES_SLOW_POLL_MS, useScheduledMessages } from '../use-scheduled-messages';

// E05/F07/US02 (NF-71): how an open page keeps the timeline of a booking up to date. A message that goes out on its own (the plan, the sweep) sends no notice to the bell, so the page reads the list again by itself while
// some message can still change, and stops when every message is over. The clock is fake; the first read is waited for BEFORE it moves.

vi.mock('@/api/scheduled-messages.api', () => ({ scheduledMessagesApi: { list: vi.fn(), edit: vi.fn(), skip: vi.fn(), sendNow: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const BOOKING_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
/** The moment the tests start at: 07:00 in Rome. */
const NOW = '2026-11-24T06:00:00Z';

const list = vi.mocked(scheduledMessagesApi.list);

function msg(overrides: Partial<ScheduledMessage> = {}): ScheduledMessage {
  return {
    id: 'm-1',
    bookingId: BOOKING_ID,
    routineId: 'r-1',
    routineName: 'Messaggio di arrivo',
    actionIndex: 0,
    plannedAtUtc: '2026-11-27T07:00:00Z',
    timeZone: 'Europe/Rome',
    status: 'Scheduled',
    blockedReason: null,
    skipReason: null,
    edited: false,
    outsideHours: false,
    sentAt: null,
    sentThreadKey: null,
    channel: 'Ota',
    channelReason: null,
    text: 'Ciao Mario',
    missingVariables: [],
    canEdit: true,
    canSkip: true,
    canSendNow: true,
    ...overrides,
  };
}

/** The same message once it went out on its own. */
function sent(plannedAtUtc: string): ScheduledMessage {
  return msg({ plannedAtUtc, status: 'Sent', sentAt: plannedAtUtc, text: null, channel: 'None', canEdit: false, canSkip: false, canSendNow: false });
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
  return { client, wrapper };
}

/** Moves the clock by `ms` and lets the reads that fall in that time (and what they set going) finish. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useScheduledMessages: how a page left open keeps the timeline up to date', () => {
  it('useScheduledMessages_AMessageDaysAway_IsReadAgainAtTheSlowPace_UntilItGoesOutOnItsOwn_AndThenNoMore', async () => {
    const planned = '2026-11-27T07:00:00Z';
    list.mockResolvedValueOnce([msg({ plannedAtUtc: planned })]);
    list.mockResolvedValue([sent(planned)]);
    const { wrapper } = setup();
    const { result } = renderHook(() => useScheduledMessages(BOOKING_ID, true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]?.status).toBe('Scheduled');
    expect(list).toHaveBeenCalledTimes(1);

    // A page left alone with a message three days away is not silent: it asks again, but not before the slow pace has passed.
    await advance(SCHEDULED_MESSAGES_SLOW_POLL_MS / 2);
    expect(list).toHaveBeenCalledTimes(1);
    await advance(SCHEDULED_MESSAGES_SLOW_POLL_MS);
    expect(list).toHaveBeenCalledTimes(2);
    // The message went out on its own (no notice for it): the page says so without a reload.
    expect(result.current.data?.[0]?.status).toBe('Sent');

    // With every message over, it asks for nothing more, however long the tab stays open.
    await advance(SCHEDULED_MESSAGES_SLOW_POLL_MS * 3);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('useScheduledMessages_AMessageDueWithinTwoHours_IsReadAgainEveryMinute', async () => {
    list.mockResolvedValue([msg({ plannedAtUtc: '2026-11-24T07:00:00Z' })]);
    const { wrapper } = setup();
    const { result } = renderHook(() => useScheduledMessages(BOOKING_ID, true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(list).toHaveBeenCalledTimes(1);

    // Not before the minute has passed, then once a minute (the time moves in steps that leave half a minute on each side of every read).
    await advance(SCHEDULED_MESSAGES_POLL_MS / 2);
    expect(list).toHaveBeenCalledTimes(1);
    await advance(SCHEDULED_MESSAGES_POLL_MS);
    expect(list).toHaveBeenCalledTimes(2);
    await advance(SCHEDULED_MESSAGES_POLL_MS);
    expect(list).toHaveBeenCalledTimes(3);
  });

  // The pace is chosen again after every read: the clock moving is not an update of the query, so a page opened three hours before a message would otherwise stay at the slow pace for ever.
  it('useScheduledMessages_AMessageThatBecomesNearWhilePageIsOpen_MovesToTheQuickPaceByItself', async () => {
    list.mockResolvedValue([msg({ plannedAtUtc: '2026-11-24T08:04:00Z' })]);
    const { wrapper } = setup();
    const { result } = renderHook(() => useScheduledMessages(BOOKING_ID, true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(list).toHaveBeenCalledTimes(1);

    // Two hours and four minutes away: the slow pace. After the first slow read it is one hour and 59 minutes away.
    await advance(SCHEDULED_MESSAGES_SLOW_POLL_MS + 10_000);
    expect(list).toHaveBeenCalledTimes(2);
    // From there it is read every minute, not every five: two more reads in two minutes (the slow pace would have given none).
    await advance(SCHEDULED_MESSAGES_POLL_MS * 2);
    expect(list).toHaveBeenCalledTimes(4);
  });

  it.each(['Blocked', 'Failed'] as const)('useScheduledMessages_A%sMessage_IsReadAgainEveryMinute_WhateverItsTime', async (status) => {
    list.mockResolvedValue([msg({ status, plannedAtUtc: '2026-12-20T07:00:00Z' })]);
    const { wrapper } = setup();
    const { result } = renderHook(() => useScheduledMessages(BOOKING_ID, true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await advance(SCHEDULED_MESSAGES_POLL_MS + 30_000);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it.each(['Sent', 'Skipped', 'Cancelled', 'Expired'] as const)('useScheduledMessages_OnlyMessagesThatAre%s_AsksForNothingMore', async (status) => {
    list.mockResolvedValue([msg({ status, plannedAtUtc: '2026-11-24T05:00:00Z' })]);
    const { wrapper } = setup();
    const { result } = renderHook(() => useScheduledMessages(BOOKING_ID, true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await advance(SCHEDULED_MESSAGES_SLOW_POLL_MS * 3);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('useScheduledMessages_APageThatIsLeft_AsksNothingMore', async () => {
    list.mockResolvedValue([msg({ status: 'Blocked' })]);
    const { wrapper } = setup();
    const { result, unmount } = renderHook(() => useScheduledMessages(BOOKING_ID, true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(list).toHaveBeenCalledTimes(1);

    unmount();
    await advance(SCHEDULED_MESSAGES_SLOW_POLL_MS * 3);
    expect(list).toHaveBeenCalledTimes(1);
  });
});
