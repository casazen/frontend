import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { calendarChangesApi } from '@/api/calendar-changes.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { retryTransientErrors } from '@/lib/query-client';
import type { CalendarChange, CalendarChangeRequest } from '@/types/calendar-changes.types';
import { useRestartOnNewWaiting, useWatchWindow } from './use-watch-window';

const CALENDAR_KEY = ['bookings', 'calendar'] as const;
const CHANGES_KEY = [...CALENDAR_KEY, 'changes'] as const;

export const CHANGE_POLL_MS = 5_000;

export const CHANGE_WATCH_MS = 180_000;

const isChangeWaiting = (change: Pick<CalendarChange, 'state'> | undefined): boolean => change?.state === 'Queued' || change?.state === 'Sending';

/**
 * One change of the calendar with the state of each property (E08/F05/US02/T02). While it is `Queued` or `Sending` it is read again every five seconds, up to
 * `CHANGE_WATCH_MS` from when the screen opened, from the moment the change starts to wait again (a "Retry now") or from the last `checkAgain`: `watchOver` says the window is
 * over while the change is still waiting. A 404 is a change that is not there, whatever an earlier read left in the cache; `enabled: false` reads nothing.
 */
export function useCalendarChange(id: string | undefined, options: { enabled?: boolean; initial?: CalendarChange } = {}) {
  const watch = useWatchWindow(CHANGE_POLL_MS, CHANGE_WATCH_MS);
  const query = useQuery({
    queryKey: [...CHANGES_KEY, 'detail', id],
    queryFn: () => calendarChangesApi.get(id!),
    enabled: !!id && (options.enabled ?? true),
    initialData: options.initial,
    staleTime: 0,
    refetchOnMount: 'always',
    // No retry of its own: while the change is waiting the next read is a few seconds away anyway, and a failure is said at once.
    retry: false,
    refetchInterval: (current) => (isChangeWaiting(current.state.data) && Date.now() - watch.since < CHANGE_WATCH_MS ? CHANGE_POLL_MS : false),
  });
  const waiting = isChangeWaiting(query.data);
  useRestartOnNewWaiting(watch, id && waiting ? [id] : []);
  const { refetch } = query;
  return {
    ...query,
    watchOver: watch.over && waiting,
    checkAgain: () => {
      watch.restart();
      void refetch();
    },
  };
}

export function useCalendarChanges(options: { enabled?: boolean } = {}) {
  const watch = useWatchWindow(CHANGE_POLL_MS, CHANGE_WATCH_MS);
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
  const waitingIds = (query.data ?? []).filter(isChangeWaiting).map((change) => change.id);
  useRestartOnNewWaiting(watch, waitingIds);
  const { refetch } = query;
  return {
    ...query,
    watchOver: watch.over && waitingIds.length > 0,
    checkAgain: () => {
      watch.restart();
      void refetch();
    },
  };
}

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
