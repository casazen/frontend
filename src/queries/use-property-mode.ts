import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { propertyModeApi } from '@/api/property-mode.api';
import { getProblemMessage } from '@/lib/api-errors';
import type { RentalMode } from '@/types/property.types';
import type { SchedulePropertyModeChangeDto } from '@/types/property-mode.types';

const PROPERTIES_KEY = 'properties';

interface ModeQueryOptions {
  /** `false` keeps the request from being sent: the flag `propertyModeChange` is off, or the answer is not needed yet. */
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
 * What a change to `to` on `date` would meet today (`date` empty: the first day possible). Never kept as fresh: the stays and
 * leases that stand in the way change under the host's feet, so the wizard asks again whenever the answer is shown.
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
    ...(options.fresh ? { refetchOnMount: 'always' as const } : {}),
  });
}

/**
 * A change of mode (programmed or withdrawn) changes the lists, the property and its state, and the host calendar (the block
 * of the nights the change closes appears or goes away).
 */
function refreshAfterModeChange(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY] });
  void queryClient.invalidateQueries({ queryKey: ['bookings', 'calendar'] });
}

/**
 * Programs the change. No toast, neither on success (the last screen of the wizard confirms) nor on failure (the wizard
 * shows the reason at its last step, next to the button).
 */
export function useSchedulePropertyModeChange(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SchedulePropertyModeChangeDto) => propertyModeApi.schedule(propertyId, data),
    onSuccess: () => refreshAfterModeChange(queryClient),
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
