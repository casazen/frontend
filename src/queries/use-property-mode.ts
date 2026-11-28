import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { propertyModeApi } from '@/api/property-mode.api';
import { getProblemMessage } from '@/lib/api-errors';
import type { RentalMode } from '@/types/property.types';
import type { SchedulePropertyModeChangeDto } from '@/types/property-mode.types';

const PROPERTIES_KEY = 'properties';

interface ModeQueryOptions {
  enabled?: boolean;
  fresh?: boolean;
}

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

function refreshAfterModeChange(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY] });
  void queryClient.invalidateQueries({ queryKey: ['bookings', 'calendar'] });
  queryClient.removeQueries({ queryKey: ['bookings', 'calendar'], type: 'inactive' });
}

export function useSchedulePropertyModeChange(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SchedulePropertyModeChangeDto) => propertyModeApi.schedule(propertyId, data),
    onSettled: () => refreshAfterModeChange(queryClient),
  });
}

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
    onSettled: () => refreshAfterModeChange(queryClient),
  });
}
