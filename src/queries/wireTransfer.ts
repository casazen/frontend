import { useMutation } from '@tanstack/react-query';
import { wireTransferApi } from '@/api/wireTransfer.api';
import type { CreateBatchRequest } from '@/types';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { saveDownload } from './save-download';

/*
 * The three writes of the wire files carry the debit account of the agency, the file with the accounts of the owners, or a payment: each mutation is dropped
 * as soon as nothing watches it (`gcTime: 0`), keeps of a failure the answer of the server without the request that was sent (`withoutRequest`: the body held
 * the account), and returns nothing that holds an account or a file. The page tells the outcome in words (a toast would be gone before it is read).
 */

/**
 * Creates a wire file from the given statements (`debitAccount` is the IBAN to pay from). The answer is the batch: its id, currency, total and number of
 * transfers, as the server computed them.
 */
export function useCreateBatch() {
  return useMutation({
    mutationFn: async (data: CreateBatchRequest) => {
      try {
        return await wireTransferApi.createBatch(data);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
  });
}

/**
 * Saves the file of a batch (SEPA pain.001 or Swiss Payment Standards XML) under the name the server gave it, and lets the bytes go: the blob is not kept
 * by the cache and its address is released by `saveBlobAs`.
 */
export function useDownloadBatchFile() {
  return useMutation({
    mutationFn: ({ batchId, fallbackName }: { batchId: string; fallbackName: string }) =>
      saveDownload(wireTransferApi.downloadBatchFile(batchId), fallbackName),
    gcTime: 0,
  });
}

/** Marks the batch as paid, by the administrator's word. The server's answer decides: the page changes only what the answer says. */
export function useConfirmPaid() {
  return useMutation({
    mutationFn: async (batchId: string) => {
      try {
        return await wireTransferApi.confirmPaid(batchId);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
  });
}
