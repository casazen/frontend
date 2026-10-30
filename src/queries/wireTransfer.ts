import { useMutation, useQueryClient } from '@tanstack/react-query';
import { wireTransferApi } from '@/api/wireTransfer.api';
import type { CreateBatchRequest } from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';

/**
 * Create a wire transfer batch from the given statement IDs.
 * Returns the batch ID, currency, total amount, and transfer count.
 */
export function useCreateBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBatchRequest) => wireTransferApi.createBatch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statements'] });
      toast.success(i18n.t('wire.batch.createSuccess'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('wire.batch.createError'));
    },
  });
}

/**
 * Download the wire transfer batch file (SEPA pain.001 or Swiss Payment Standards XML).
 */
export function useDownloadBatchFile() {
  return useMutation({
    mutationFn: async ({ batchId, fileName }: { batchId: string; fileName: string }) => {
      const blob = await wireTransferApi.downloadBatchFile(batchId);
      saveBlobAs(blob, fileName);
    },
    onSuccess: () => {
      toast.success(i18n.t('wire.batch.downloadSuccess'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('wire.batch.downloadError'));
    },
  });
}

/**
 * Confirm that the batch file has been downloaded.
 * Updates the batch status to Downloaded.
 */
export function useConfirmDownload() {
  return useMutation({
    mutationFn: (batchId: string) => wireTransferApi.confirmDownload(batchId),
    onSuccess: () => {
      toast.success(i18n.t('wire.batch.confirmDownloadSuccess'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('wire.batch.confirmDownloadError'));
    },
  });
}

/**
 * Confirm that the batch has been paid (wire transfers executed at the bank).
 * Updates the batch status to Paid.
 */
export function useConfirmPayment() {
  return useMutation({
    mutationFn: (batchId: string) => wireTransferApi.confirmPaid(batchId),
    onSuccess: () => {
      toast.success(i18n.t('wire.batch.confirmPaidSuccess'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('wire.batch.confirmPaidError'));
    },
  });
}
