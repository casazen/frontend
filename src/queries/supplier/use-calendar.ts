import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { decideFreeEvent, disconnectIcalFeed, fetchCalendarSyncStatus, fetchPendingFreeEvents, fetchSupplierAgendaCalendar, fetchSupplierConflicts, fetchSupplierHours, saveSupplierHours, setIcalFeed, syncSupplierCalendarNow, updateSupplierAvailability } from '@/services/supplier-api';
import type { CalendarSyncStatus, FreeEventDecision, SupplierAgendaHoursDay, UpdateAvailabilityEntry } from '@/types/supplier';

/**
 * Light polling while the supplier's calendar is syncing (its job is queued, SU-15): every few seconds during the first
 * minute, when the download usually ends, then slower until the 15-minute job settles it.
 */
const SYNCING_FAST_REFETCH_MS = 3_000;

const SYNCING_SLOW_REFETCH_MS = 15_000;

const SYNCING_FAST_WINDOW_MS = 60_000;


const CALENDAR_SYNC_KEY = ['supplier', 'calendar-sync'] as const;


// When each status query started to see `Syncing` (keyed by the query object, dropped with it).
const syncingSince = new WeakMap<object, number>();


/** Next poll of the calendar status: none unless it is `Syncing`, otherwise fast first and then slower. */
export function supplierSyncRefetchInterval(
  query: { state: { data?: CalendarSyncStatus } },
  now: number = Date.now(),
): number | false {
  if (query.state.data?.lastSyncStatus !== 'Syncing') {
    syncingSince.delete(query);
    return false;
  }
  const since = syncingSince.get(query) ?? now;
  syncingSince.set(query, since);
  return now - since < SYNCING_FAST_WINDOW_MS ? SYNCING_FAST_REFETCH_MS : SYNCING_SLOW_REFETCH_MS;
}


/**
 * What the agenda shows from `from` to `to` (at most 62 days): the weekly hours, the closed days, the time off, the blocks and
 * calendar events, and the requests. Fetched again every time the page opens: a request taken on another page puts a job in it.
 */
export function useSupplierAgendaCalendar(from: string, to: string) {
  return useQuery({
    queryKey: ['supplier', 'agenda', from, to],
    queryFn: () => fetchSupplierAgendaCalendar(from, to),
    refetchOnMount: 'always',
  });
}


/**
 * The jobs of the next 30 days with something wrong (SP-03b). Under `['supplier', 'agenda']`: whatever reloads the agenda (hours saved, a
 * day closed, an answer to a calendar event) reloads this too. Fetched again when the page opens: a request taken or moved on another
 * page changes it.
 */
export function useSupplierConflicts() {
  return useQuery({
    queryKey: ['supplier', 'agenda', 'conflicts'],
    queryFn: fetchSupplierConflicts,
    refetchOnMount: 'always',
  });
}


export function useSupplierHours() {
  return useQuery({
    queryKey: ['supplier', 'hours'],
    queryFn: fetchSupplierHours,
  });
}


export function useSaveSupplierHours() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (days: SupplierAgendaHoursDay[]) => saveSupplierHours(days),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['supplier', 'hours'] });
      void queryClient.invalidateQueries({ queryKey: ['supplier', 'agenda'] });
      void queryClient.invalidateQueries({ queryKey: ['supplier', 'availability'] });
    },
  });
}


export function useUpdateSupplierAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dates: UpdateAvailabilityEntry[]) => updateSupplierAvailability(dates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['supplier', 'availability'] });
      void queryClient.invalidateQueries({ queryKey: ['supplier', 'agenda'] });
    },
  });
}


/**
 * Calendar sync status of the supplier, polled while `Syncing`. When a sync ends the availability and the dashboard are
 * refreshed: the days of the feed may have changed.
 */
export function useCalendarSyncStatus() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: CALENDAR_SYNC_KEY,
    queryFn: async () => {
      const previous = queryClient.getQueryData<CalendarSyncStatus>(CALENDAR_SYNC_KEY);
      const next = await fetchCalendarSyncStatus();
      if (previous?.lastSyncStatus === 'Syncing' && next.lastSyncStatus !== 'Syncing') {
        void queryClient.invalidateQueries({ queryKey: ['supplier', 'availability'] });
        void queryClient.invalidateQueries({ queryKey: ['supplier', 'agenda'] });
        void queryClient.invalidateQueries({ queryKey: ['supplier', 'dashboard'] });
      }
      return next;
    },
    refetchInterval: supplierSyncRefetchInterval,
  });
}


/** Saves the iCal URL: the answer (`Syncing`) replaces the status at once, which starts the polling. */
export function useSetIcalFeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setIcalFeed,
    onSuccess: (status) => {
      queryClient.setQueryData(CALENDAR_SYNC_KEY, status);
      void queryClient.invalidateQueries({ queryKey: ['supplier'], predicate: (query) => query.queryKey[1] !== 'calendar-sync' });
    },
  });
}


/**
 * Unlinks the iCal feed (SP-03b): the status reads "not linked" at once, and what the feed had closed or asked is read again (the
 * days and hours open again, the events marked "Disponibile" and their answers are gone). The supplier's own blocks stay.
 */
export function useDisconnectIcalFeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disconnectIcalFeed,
    onSuccess: () => {
      queryClient.setQueryData<CalendarSyncStatus>(CALENDAR_SYNC_KEY, (previous) =>
        previous
          ? {
              ...previous,
              calendarSyncType: 'None',
              icalFeedUrl: null,
              calendarLastSyncAt: null,
              lastSyncStatus: 'None',
              calendarSyncErrorCode: null,
              calendarSyncError: null,
              pendingFreeEventsCount: 0,
            }
          : previous,
      );
      for (const key of ['calendar-sync', 'free-events', 'agenda', 'availability', 'dashboard']) {
        void queryClient.invalidateQueries({ queryKey: ['supplier', key] });
      }
    },
  });
}


/** "Sync now" of the supplier's iCal feed (SU-15): the answer (`Syncing`) replaces the status and starts the polling. */
export function useSyncSupplierCalendarNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncSupplierCalendarNow,
    onSuccess: (status) => {
      queryClient.setQueryData(CALENDAR_SYNC_KEY, status);
    },
  });
}


/** Calendar events marked "Disponibile" waiting for the supplier's answer (only the owner reads them). */
export function usePendingFreeEvents() {
  return useQuery({
    queryKey: ['supplier', 'free-events'],
    queryFn: fetchPendingFreeEvents,
  });
}


/**
 * The supplier's answer for a free event. "Available" frees the days again and the backend queues a sync: the status is
 * marked `Syncing` at once (the polling of `useCalendarSyncStatus` takes over and refreshes agenda, availability and
 * dashboard when it ends). Either way the list, the agenda, the availability and the dashboard are reloaded.
 */
export function useDecideFreeEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: FreeEventDecision }) => decideFreeEvent(id, decision),
    onSuccess: (_data, { decision }) => {
      if (decision === 'Available') {
        queryClient.setQueryData<CalendarSyncStatus>(CALENDAR_SYNC_KEY, (previous) =>
          previous ? { ...previous, lastSyncStatus: 'Syncing' } : previous,
        );
      }
      for (const key of ['free-events', 'agenda', 'availability', 'dashboard', 'calendar-sync']) {
        void queryClient.invalidateQueries({ queryKey: ['supplier', key] });
      }
    },
  });
}
