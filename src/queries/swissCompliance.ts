import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { swissComplianceApi } from '@/api/swissCompliance.api';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';
import type { TicinoNotificationRequest, UploadSwissReceiptForm } from '@/types/swissCompliance.types';

const TICINO_KEY = 'ticino-police';

/** One arrival day of the Ticino police notification of a property (casazen/backend#979); `date` empty = the oldest day still to notify. */
export function useTicinoDay(propertyId: string, date?: string) {
  return useQuery({
    queryKey: [TICINO_KEY, propertyId, date ?? ''],
    queryFn: () => swissComplianceApi.getTicinoDay(propertyId, date),
    enabled: Boolean(propertyId),
  });
}

/** Downloads the file of the day for notifiche.ti.ch (the server names it; the name here is the same). */
export function useDownloadTicinoFile(propertyId: string) {
  return useMutation({
    mutationFn: async (request: TicinoNotificationRequest) => {
      const blob = await swissComplianceApi.downloadTicinoFile(propertyId, request);
      saveBlobAs(blob, `notifiche-ti-${request.reportDate}.${request.format}`);
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('swiss.file.downloadFailed'));
    },
  });
}

/** Records the receipt of the portal for the day: the day is notified, the cockpit item closes. */
export function useUploadReceipt(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (form: UploadSwissReceiptForm) => swissComplianceApi.uploadReceipt(propertyId, form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TICINO_KEY, propertyId] });
      void queryClient.invalidateQueries({ queryKey: ['compliance'] });
      toast.success(i18n.t('swiss.receipt.uploadSuccess'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('swiss.receipt.uploadFailed'));
    },
  });
}
