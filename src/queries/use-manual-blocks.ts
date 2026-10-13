import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { manualBlocksApi } from '@/api/manual-blocks.api';
import type { CreateManualBlockDto } from '@/types/calendar.types';

/**
 * A manual block changes the host calendar and the dashboard nights (PC-09). The public availability is read by the
 * guests' browsers and is not cached here.
 */
function refreshAfterBlockChange(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['bookings', 'calendar'] });
  void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
}

/** "Blocca date" (PC-09). No error toast: the form shows the error next to its fields. */
export function useCreateManualBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ propertyId, data }: { propertyId: string; data: CreateManualBlockDto }) =>
      manualBlocksApi.create(propertyId, data),
    onSuccess: () => {
      refreshAfterBlockChange(queryClient);
      toast.success(i18n.t('booking.calendar.manualBlock.created'));
    },
  });
}

/** "Elimina blocco" (PC-09). No error toast: the block panel shows the error. */
export function useDeleteManualBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ propertyId, blockId }: { propertyId: string; blockId: string }) =>
      manualBlocksApi.remove(propertyId, blockId),
    onSuccess: () => {
      refreshAfterBlockChange(queryClient);
      toast.success(i18n.t('booking.calendar.manualBlock.deleted'));
    },
  });
}
