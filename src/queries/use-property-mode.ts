import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { propertyModeApi } from '@/api/property-mode.api';
import { getProblemMessage } from '@/lib/api-errors';
import type { RentalMode } from '@/types/property.types';
import type { SchedulePropertyModeChangeDto } from '@/types/property-mode.types';

const PROPERTIES_KEY = 'properties';

interface ModeQueryOptions {
  /** `false` keeps the request from being sent: the answer is not needed yet (the last screen, an incomplete day). */
  enabled?: boolean;
  /** Read again from the server when the page opens even when cached (the wizard starts from what the server says now). */
  fresh?: boolean;
}

/** The mode of a property, the change waiting for its day and the last one that is over (PM-02). */
export function usePropertyModeState(propertyId: string, options: ModeQueryOptions = {}) {
  return useQuery({
    queryKey: [PROPERTIES_KEY, propertyId, 'mode'],
    queryFn: () => propertyModeApi.getState(propertyId),
    enabled: Boolean(propertyId) && (options.enabled ?? true),
    ...(options.fresh ? { refetchOnMount: 'always' as const } : {}),
  });
}

/**
 * What a change to `to` on `date` would meet today (`date` empty: the first day possible). The stays and leases that stand in the
 * way change under the host's feet, so an answer is never kept once nobody shows it (`gcTime: 0`: the wizard cannot open on the
 * answer of a previous visit) and the steps ask again when they open. It is not asked again by itself when the tab regains the
 * focus: the answer is on screen and decides what the buttons do, so it only changes when the person changes the day.
 */
export function usePropertyModePreview(
  propertyId: string,
  to: RentalMode,
  date: string | undefined,
  options: ModeQueryOptions = {},
) {
  return useQuery({
    queryKey: [PROPERTIES_KEY, propertyId, 'mode', 'preview', to, date ?? ''],
    queryFn: () => propertyModeApi.preview(propertyId, to, date),
    enabled: Boolean(propertyId) && (options.enabled ?? true),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    ...(options.fresh ? { refetchOnMount: 'always' as const } : {}),
  });
}

/**
 * A change of mode (programmed or withdrawn) changes the lists, the property and its state, and the host calendar (the block
 * of the nights the change closes appears or goes away). The calendar is not on screen when this runs and the app does not
 * refetch an invalidated query on mount (`refetchOnMount: false`), so the cached months are dropped: the next visit loads them.
 */
function refreshAfterModeChange(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY] });
  void queryClient.invalidateQueries({ queryKey: ['bookings', 'calendar'] });
  queryClient.removeQueries({ queryKey: ['bookings', 'calendar'], type: 'inactive' });
}

/**
 * Programs the change. No toast, neither on success (the last screen of the wizard confirms) nor on failure (the wizard
 * shows the reason at its last step, next to the button). The caches are refreshed also after a refusal: "a change already
 * waits" and "already in that mode" mean the page was showing an old state, and the fresh one brings the right screen.
 */
export function useSchedulePropertyModeChange(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SchedulePropertyModeChangeDto) => propertyModeApi.schedule(propertyId, data),
    onSettled: () => refreshAfterModeChange(queryClient),
  });
}

/**
 * Withdraws the change that waits for its day. It is not a toast with "Undo": programming it again is not the same thing (a stay
 * may have come in the meantime), so nothing here promises that it can be taken back.
 */
export function useCancelPropertyModeChange(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (changeId: string) => propertyModeApi.cancel(propertyId, changeId),
    onSuccess: () => {
      toast.success(i18n.t('propertyMode.cancel.done'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('propertyMode.cancel.failed'));
    },
    // Also after a failure: "not found" and "not scheduled any more" mean the page was showing an old state.
    onSettled: () => refreshAfterModeChange(queryClient),
  });
}
