import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CinApi } from '@/api/cin.api';
import { toast } from 'sonner';
import i18n from '@/i18n/config';

const CIN_KEY = 'cin';

export function useCinCompliance(params?: { cinStatus?: string }) {
  return useQuery({
    queryKey: [CIN_KEY, 'compliance', params],
    queryFn: () => CinApi.getCompliance(params),
  });
}

export function useUpdatePropertyCin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ propertyId, cinCode }: { propertyId: string; cinCode: string | null }) =>
      CinApi.updatePropertyCin(propertyId, { cinCode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CIN_KEY] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success(i18n.t('toast.cinCodeUpdated'));
    },
    onError: () => {
      toast.error(i18n.t('toast.cinCodeUpdateFailed'));
    },
  });
}
