import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { manualBlocksApi } from '@/api/manual-blocks.api';
import type { CreateManualBlockDto } from '@/types/calendar.types';

function refreshAfterBlockChange(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['bookings', 'calendar'] });
  void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
}

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
