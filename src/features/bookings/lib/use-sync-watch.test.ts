import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { BookingOctorateSync } from '@/types';
import { SYNC_PENDING_LIMIT_MS, SYNC_POLL_MS, SYNC_WATCH_MS } from './octorate-sync';
import { useSyncWatch } from './use-sync-watch';

const pending: BookingOctorateSync = { state: 'Pending', lastOperation: 'Update', lastSyncedAt: null, errorCode: null, canRetry: false };

describe('useSyncWatch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('useSyncWatch_PushNotAnsweredWithinTheLimit_StopsWaitingByItself', () => {
    const { result } = renderHook(() => useSyncWatch());
    expect(result.current.waitOver).toBe(false);

    act(() => {
      vi.advanceTimersByTime(SYNC_PENDING_LIMIT_MS - 1_000);
    });
    expect(result.current.waitOver).toBe(false);
    expect(result.current.interval(pending)).not.toBe(false);

    // The page is drawn again when the wait ends: nobody has to touch it.
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current.waitOver).toBe(true);
    expect(result.current.interval(pending)).toBe(false);
  });

  it('useSyncWatch_AskedAgainAfterTheLimit_WaitsForOneMoreMinuteAndThenStopsAgain', () => {
    const { result } = renderHook(() => useSyncWatch());
    act(() => {
      vi.advanceTimersByTime(SYNC_PENDING_LIMIT_MS + 1_000);
    });
    expect(result.current.waitOver).toBe(true);

    act(() => result.current.ask());
    expect(result.current.waitOver).toBe(false);
    expect(result.current.interval(pending)).toBe(SYNC_POLL_MS);

    act(() => {
      vi.advanceTimersByTime(SYNC_WATCH_MS - 1_000);
    });
    expect(result.current.waitOver).toBe(false);
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current.waitOver).toBe(true);
    expect(result.current.interval(pending)).toBe(false);
  });

  it('useSyncWatch_AskedBeforeTheLimit_DoesNotMoveTheLimit', () => {
    const { result } = renderHook(() => useSyncWatch());
    act(() => {
      vi.advanceTimersByTime(5_000);
      result.current.ask();
    });

    act(() => {
      vi.advanceTimersByTime(SYNC_PENDING_LIMIT_MS - 4_000);
    });
    expect(result.current.waitOver).toBe(true);
  });
});
