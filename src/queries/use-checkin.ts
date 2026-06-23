import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { checkinApi } from '@/api/checkin.api';
import type { SubmitGuestCheckInRequest } from '@/types/alloggiati.types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';

const CHECKIN_KEY = 'checkin';

export function useCheckInContext(token: string) {
  return useQuery({
    queryKey: [CHECKIN_KEY, token],
    queryFn: () => checkinApi.getContext(token),
    enabled: !!token,
    retry: 1,
  });
}

export function useSubmitGuestCheckIn(token: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SubmitGuestCheckInRequest) => checkinApi.submitGuestData(token, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKIN_KEY, token] });
      toast.success(i18n.t('toast.checkInDataSaved'));
    },
    onError: () => {
      toast.error(i18n.t('toast.checkInDataSaveFailed'));
    },
  });
}

export function useUploadCheckInDocument(token: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => checkinApi.uploadDocument(token, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKIN_KEY, token] });
      toast.success(i18n.t('toast.checkInDocumentUploaded'));
    },
    onError: () => {
      toast.error(i18n.t('toast.checkInDocumentUploadFailed'));
    },
  });
}
