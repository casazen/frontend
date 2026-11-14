import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { wireTransferApi } from '@/api/wireTransfer.api';
import type { CreateBatchRequest } from '@/types';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { saveDownload } from './save-download';

/** Root of the query keys of the wire files and of what the wire page reads to build them. */
export const WIRE_KEY = 'wire-transfers';
const BATCHES_KEY = [WIRE_KEY, 'batches'] as const;

// ── Reads ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// The three of them are read again every time the page opens and soon after (`staleTime`): other people of the agency confirm payouts and move the batches too, and a page
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

/** The payouts of the org (the confirmed ones are what a file can pay). */
export function useWirePayouts() {
  return useQuery({
    queryKey: [WIRE_KEY, 'payouts'],
    queryFn: () => wireTransferApi.listPayouts(),
    refetchOnMount: 'always' as const,
    staleTime: 30_000,
  });
}

/** The owners of the registry: their name and the end of their IBAN, nothing else. */
export function useWireOwners() {
  return useQuery({
    queryKey: [WIRE_KEY, 'owners'],
    queryFn: () => wireTransferApi.listOwners(),
    refetchOnMount: 'always' as const,
    staleTime: 30_000,
  });
}

// ── Writes ────────────────────────────────────────────────────────────────────────────────────────────────────────
/*
 * The writes of the wire files carry the payouts of a payment or hand out the file with the accounts of the owners: each mutation is dropped as soon as nothing watches it
 * (`gcTime: 0`), keeps of a failure the answer of the server without the request that was sent (`withoutRequest`), and returns nothing that holds an account or a file.
 * Whatever the answer, the list of the batches is read again before the mutation ends: the server says where the batch is now (someone else may have moved it), and
 * the page shows that, never what it guessed. The page tells the outcome in words (a toast would be gone before it is read).
 */

/**
 * Creates a wire file from confirmed payouts of one currency and the day the bank is asked to execute it. The answer is the batch: its id, currency, total and number of
 * transfers, as the server computed them.
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: BATCHES_KEY }),
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: BATCHES_KEY }),
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: BATCHES_KEY }),
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: BATCHES_KEY }),
  });
}
