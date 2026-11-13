import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { calendarChangesApi } from '@/api/calendar-changes.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { useNow } from '@/hooks/use-now';
import { retryTransientErrors } from '@/lib/query-client';
import type { CalendarChange, CalendarChangeRequest } from '@/types/calendar-changes.types';

/** The calendar views of the bookings: a change of price or rules, like a block, makes every one of them (and the list of the changes under them) stale. */
const CALENDAR_KEY = ['bookings', 'calendar'] as const;
const CHANGES_KEY = [...CALENDAR_KEY, 'changes'] as const;

/** How often a change that is waiting or being sent is read again. */
export const CHANGE_POLL_MS = 5_000;

/**
 * How long a screen keeps asking by itself for a change that is waiting or being sent. After it the screen stops (no endless polling) and says, in neutral words, that no
 * answer has come yet, with a button that asks again: the channel manager may be slow, and the host is not told that something went wrong that did not.
 */
export const CHANGE_WATCH_MS = 180_000;

/** The change is waiting to be sent or being sent: the only states that are still on their way. */
export const isChangeWaiting = (change: Pick<CalendarChange, 'state'> | undefined): boolean => change?.state === 'Queued' || change?.state === 'Sending';

/** The window in which a screen follows a waiting change by itself: it opens when the screen does and again at each "Check again". */
function useWatchWindow() {
  const [since, setSince] = useState(() => Date.now());
  const now = useNow(CHANGE_POLL_MS);
  return { since, over: now - since >= CHANGE_WATCH_MS, restart: () => setSince(Date.now()) };
}

/**
 * One change of the calendar with the state of each property (E08/F05/US02/T02). While it is `Queued` or `Sending` it is read again every five seconds, up to
 * `CHANGE_WATCH_MS` from when the screen opened (or from the last `checkAgain`): `watchOver` says the window is over while the change is still waiting. A 404 is a change that
 * is not there, whatever an earlier read left in the cache; `enabled: false` reads nothing.
 */
export function useCalendarChange(id: string | undefined, options: { enabled?: boolean; initial?: CalendarChange } = {}) {
  const watch = useWatchWindow();
  const query = useQuery({
    queryKey: [...CHANGES_KEY, 'detail', id],
    queryFn: () => calendarChangesApi.get(id!),
    enabled: !!id && (options.enabled ?? true),
    // What the answer of the application already says (the process the API has just made): it is on screen at once, and read again at once.
    initialData: options.initial,
    staleTime: 0,
    refetchOnMount: 'always',
    // No retry of its own: while the change is waiting the next read is a few seconds away anyway, and a failure is said at once.
    retry: false,
    refetchInterval: (current) => (isChangeWaiting(current.state.data) && Date.now() - watch.since < CHANGE_WATCH_MS ? CHANGE_POLL_MS : false),
  });
  const { refetch } = query;
  return {
    ...query,
    watchOver: watch.over && isChangeWaiting(query.data),
    checkAgain: () => {
      watch.restart();
      void refetch();
    },
  };
}

/**
 * The changes of the calendar the caller may see, newest first (E08/F05/US02/T02): the line above the calendar and its list. Read again whenever the calendar is shown, and
 * every five seconds while one is waiting or being sent, up to `CHANGE_WATCH_MS` (then `watchOver`). `enabled: false` reads nothing: the list needs `property.read`.
 */
export function useCalendarChanges(options: { enabled?: boolean } = {}) {
  const watch = useWatchWindow();
  const query = useQuery({
    queryKey: [...CHANGES_KEY, 'list'],
    queryFn: () => calendarChangesApi.list(),
    enabled: options.enabled ?? true,
    staleTime: 5_000,
    refetchOnMount: 'always',
    retry: retryTransientErrors(1),
    refetchInterval: (current) =>
      (current.state.data ?? []).some(isChangeWaiting) && Date.now() - watch.since < CHANGE_WATCH_MS ? CHANGE_POLL_MS : false,
  });
  const { refetch } = query;
  return {
    ...query,
    watchOver: watch.over && (query.data ?? []).some(isChangeWaiting),
    checkAgain: () => {
      watch.restart();
      void refetch();
    },
  };
}

/**
 * What a change would do, and nothing else (E08/F05/US02/T03): nothing is saved or sent. The mutation is not kept once nothing observes it (`gcTime: 0`) and a refusal is
 * kept without the request that was sent (`withoutRequest`: it holds the access token of the call).
 */
export function usePreviewCalendarChange() {
  return useMutation({
    gcTime: 0,
    mutationFn: async (request: CalendarChangeRequest) => {
      try {
        return await calendarChangesApi.preview(request);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
  });
}

/**
 * Applies a change of price or rules, all or nothing, and answers the process that sends it to the channel manager (E08/F05/US02/T03). A success makes every calendar view
 * and the list of the changes stale. No toast: the panel and the wizard say in words what happened to each property. Not kept once nothing observes it (`gcTime: 0`), and a
 * refusal is kept without the request (`withoutRequest`).
 */
export function useApplyCalendarChange() {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async (request: CalendarChangeRequest) => {
      try {
        return await calendarChangesApi.apply(request);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
    },
  });
}

/**
 * "Retry now": sends again a change that failed or was partly sent (E08/F05/US02/T02). Whatever the answer (a 409 "nothing to retry" included) the changes are read again, so
 * the screen shows what the server holds. A refusal is kept without the request that was sent (`withoutRequest`).
 */
export function useRetryCalendarChange() {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async (id: string) => {
      try {
        return await calendarChangesApi.retry(id);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: CHANGES_KEY });
    },
  });
}
