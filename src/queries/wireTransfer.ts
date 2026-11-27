import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { wireTransferApi } from '@/api/wireTransfer.api';
import type { CreateBatchRequest, WireCurrency } from '@/types';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { saveDownload } from './save-download';

/** Root of the query keys of the wire files and of what the wire page reads to build them. */
const WIRE_KEY = 'wire-transfers';
const BATCHES_KEY = [WIRE_KEY, 'batches'] as const;
/** The payable payouts, one list per currency: `[WIRE_KEY, 'payable', 'CHF']` and `[WIRE_KEY, 'payable', 'EUR']`. */
const PAYABLE_KEY = [WIRE_KEY, 'payable'] as const;
/** The payouts of a batch, one read per batch: `[WIRE_KEY, 'batch-payouts', batchId]`. */
const BATCH_PAYOUTS_KEY = [WIRE_KEY, 'batch-payouts'] as const;

// ── Reads ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// All of them are read again every time the page opens and soon after (`staleTime`): other people of the agency confirm payouts and move the batches too, and a page
// that is already open must not keep offering a step that is done. A `null` is the refusal of the server (403), which the page tells in words.

/** The wire files of the org, the newest first: their state, currency, number of transfers and total. Never an IBAN, a name or the file. */
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

/**
 * The payouts of a batch and its state, as the server says them now. It is only called by the part of the card that the person opened, so nothing is read for a file whose
 * payouts nobody asked for. A payout reversed after the batch was made is in it and says so.
 */
export function useWireBatchPayouts(batchId: string) {
  return useQuery({
    queryKey: [...BATCH_PAYOUTS_KEY, batchId],
    queryFn: () => wireTransferApi.getBatchPayouts(batchId),
    refetchOnMount: 'always' as const,
    staleTime: 30_000,
  });
}

// ── Writes ────────────────────────────────────────────────────────────────────────────────────────────────────────
/*
 * The writes of the wire files carry the payouts of a payment or hand out the file with the accounts of the owners: each mutation is dropped as soon as nothing watches it
 * (`gcTime: 0`), keeps of a failure the answer of the server without the request that was sent (`withoutRequest`), and returns nothing that holds an account or a file.
 * Whatever the answer, the lists the request may have moved are read again before the mutation ends: the server says where the batch is now (someone else may have moved
 * it) and which payouts can still be paid, and the page shows that, never what it guessed. The page tells the outcome in words (a toast would be gone before it is read).
 */

/** The batches and the payouts of the batches that the page has open: what a request on a file may have changed. */
function readBatchesAgain(queryClient: QueryClient) {
  return Promise.all([queryClient.invalidateQueries({ queryKey: BATCHES_KEY }), queryClient.invalidateQueries({ queryKey: BATCH_PAYOUTS_KEY })]);
}

/**
 * Creates a wire file from confirmed payouts of one currency and the day the bank is asked to execute it. The answer is the batch: its id, currency, total and number of
 * transfers, as the server computed them. After the request, made or refused, the payable payouts of both currencies are read again: the payouts that went into the file leave
 * the list at once, and after a refusal the list is what the server says now (a payout may have been put in another file by someone else, which is why it was refused).
 */
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

/**
 * Saves the file of a batch (Swiss Payment Standards or SEPA XML) under the name the server gave it, and lets the bytes go: the blob is not kept by the cache and its
 * address is released by `saveBlobAs`. The server marks the batch as downloaded the first time it hands the file out.
 */
export function useDownloadBatchFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, fallbackName }: { batchId: string; fallbackName: string }) => saveDownload(wireTransferApi.downloadBatchFile(batchId), fallbackName),
    gcTime: 0,
    onSettled: () => readBatchesAgain(queryClient),
  });
}

/** Marks the batch as downloaded, by the person's word that the file is in their hands. */
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

/** Marks the batch as paid, by the administrator's word. The server's answer decides: the page changes only what the list says afterwards. */
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
