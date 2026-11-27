import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { wireTransferApi } from '@/api/wireTransfer.api';
import type { CreateBatchRequest, WireCurrency } from '@/types';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { saveDownload } from './save-download';

const WIRE_KEY = 'wire-transfers';
const BATCHES_KEY = [WIRE_KEY, 'batches'] as const;
const PAYABLE_KEY = [WIRE_KEY, 'payable'] as const;
const BATCH_PAYOUTS_KEY = [WIRE_KEY, 'batch-payouts'] as const;

export function useWireBatches() {
  return useQuery({
    queryKey: BATCHES_KEY,
    queryFn: () => wireTransferApi.listBatches(),
    refetchOnMount: 'always' as const,
    staleTime: 30_000,
  });
}

/**
 * The payouts a wire file of ONE currency can still pay, from the server: confirmed, published to the owner and in no batch, so a payout that went into a batch is not on
 * the list and does not come back after a reload. One read per currency, never mixed. Read again when the page opens, whenever the window gets the focus back (another
 * person of the agency may have made a file meanwhile) and after every request that creates a batch, whatever the answer.
 */
export function usePayablePayouts(currency: WireCurrency) {
  return useQuery({
    queryKey: [...PAYABLE_KEY, currency],
    queryFn: () => wireTransferApi.listPayablePayouts(currency),
    refetchOnMount: 'always' as const,
    refetchOnWindowFocus: 'always' as const,
    staleTime: 30_000,
  });
}

export function useWireBatchPayouts(batchId: string) {
  return useQuery({
    queryKey: [...BATCH_PAYOUTS_KEY, batchId],
    queryFn: () => wireTransferApi.getBatchPayouts(batchId),
    refetchOnMount: 'always' as const,
    staleTime: 30_000,
  });
}

/*
 * The writes of the wire files carry the payouts of a payment or hand out the file with the accounts of the owners: each mutation is dropped as soon as nothing watches it
 * (`gcTime: 0`), keeps of a failure the answer of the server without the request that was sent (`withoutRequest`), and returns nothing that holds an account or a file.
 * Whatever the answer, the lists the request may have moved are read again before the mutation ends: the server says where the batch is now (someone else may have moved
 * it) and which payouts can still be paid, and the page shows that, never what it guessed. The page tells the outcome in words (a toast would be gone before it is read).
 */

function readBatchesAgain(queryClient: QueryClient) {
  return Promise.all([queryClient.invalidateQueries({ queryKey: BATCHES_KEY }), queryClient.invalidateQueries({ queryKey: BATCH_PAYOUTS_KEY })]);
}

export function useCreateBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateBatchRequest) => {
      try {
        return await wireTransferApi.createBatch(data);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSettled: () => Promise.all([readBatchesAgain(queryClient), queryClient.invalidateQueries({ queryKey: PAYABLE_KEY })]),
  });
}

export function useDownloadBatchFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, fallbackName }: { batchId: string; fallbackName: string }) => saveDownload(wireTransferApi.downloadBatchFile(batchId), fallbackName),
    gcTime: 0,
    onSettled: () => readBatchesAgain(queryClient),
  });
}

export function useConfirmDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (batchId: string) => {
      try {
        return await wireTransferApi.confirmDownload(batchId);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSettled: () => readBatchesAgain(queryClient),
  });
}

export function useConfirmPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (batchId: string) => {
      try {
        return await wireTransferApi.confirmPaid(batchId);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSettled: () => readBatchesAgain(queryClient),
  });
}
