import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { decideFreeEvent, disconnectIcalFeed, fetchCalendarSyncStatus, fetchPendingFreeEvents, fetchSupplierAgendaCalendar, fetchSupplierConflicts, fetchSupplierHours, saveSupplierHours, setIcalFeed, syncSupplierCalendarNow, updateSupplierAvailability } from '@/services/supplier-api';
import type { CalendarSyncStatus, FreeEventDecision, SupplierAgendaHoursDay, UpdateAvailabilityEntry } from '@/types/supplier';

const SYNCING_FAST_REFETCH_MS = 3_000;

const SYNCING_SLOW_REFETCH_MS = 15_000;

const SYNCING_FAST_WINDOW_MS = 60_000;


const CALENDAR_SYNC_KEY = ['supplier', 'calendar-sync'] as const;


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


export function useSupplierAgendaCalendar(from: string, to: string) {
  return useQuery({
    queryKey: ['supplier', 'agenda', from, to],
    queryFn: () => fetchSupplierAgendaCalendar(from, to),
    refetchOnMount: 'always',
  });
}


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


export function useSyncSupplierCalendarNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncSupplierCalendarNow,
    onSuccess: (status) => {
      queryClient.setQueryData(CALENDAR_SYNC_KEY, status);
    },
  });
}


export function usePendingFreeEvents() {
  return useQuery({
    queryKey: ['supplier', 'free-events'],
    queryFn: fetchPendingFreeEvents,
  });
}


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
