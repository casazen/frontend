import axios from '@/lib/axios';
import { ibanEnd } from '@/lib/iban';
import { ApiClient } from './client';
import { acceptsRefusal } from './accept-refusal';
import { fileApi, type DownloadedFile } from './file.api';
import type { CreateBatchRequest, CreateBatchResponse, OwnerPayout, PropertyOwnerSummary, WireBatch, WireOwner } from '@/types';

/**
 * A read that takes a refusal (403) as an answer: `null`. The shared client sends the whole app to the page of no access on a 403 for a read, and the wire page only has
 * to say that the access is not there (a role or a plan that changed since the page was drawn).
 */
async function readOrNull<T>(path: string): Promise<T | null> {
  const response = await axios.get<T>(path, { validateStatus: acceptsRefusal });
  return response.status === 403 ? null : response.data;
}

/**
 * The wire files that pay the owners (backend `api/wire-transfers`, ADR-017, E16): the owner and the administrators of an org on the agency plan
 * (`agency.wire.manage`). A batch is made from CONFIRMED PAYOUTS (the net after the withholding), one transfer for each, one file per currency, debited from the account
 * of the issuer profile of the org: the request names no account. The list of the batches never holds an IBAN, a name or the file.
 */
export const wireTransferApi = {
  /** The batches of the org, the newest first (the server gives at most 200); `null` when the server refuses it to this caller (403). */
  listBatches: () => readOrNull<WireBatch[]>('/wire-transfers/batches'),

  /**
   * The payouts of the org, the newest first (`api/owner-accounting/payouts`): the page keeps the confirmed ones. The server has no read of «the payouts not yet in a
   * batch», so the ones already in a file are refused by the server when they are chosen (`payouts_already_in_batch`). `null` on a 403.
   */
  listPayouts: () => readOrNull<OwnerPayout[]>('/owner-accounting/payouts'),

  /**
   * The owners of the registry, reduced to what the page shows: the name and the end of the IBAN (the registry answers it masked, and it is cut to its last four characters
   * again here). The e-mail, the phone and the tax regime of the answer are not kept. `null` on a 403.
   */
  listOwners: async (): Promise<WireOwner[] | null> => {
    const owners = await readOrNull<PropertyOwnerSummary[]>('/owners');
    return owners === null
      ? null
      : owners.map((owner) => ({ id: owner.id, name: `${owner.firstName} ${owner.lastName}`.trim(), ibanEnd: ibanEnd(owner.ibanMasked) }));
  },

  /**
   * Creates a wire file from confirmed payouts of ONE currency. The server checks the payouts, the issuer profile, the owners' addresses and accounts and the file against
   * its schema before it saves anything; the refusals are 422 with a `code` (the ones about owners list their `ownerIds`; `wire_batch_schema_unavailable`: no file is made).
   */
  createBatch: (data: CreateBatchRequest) => ApiClient.post<CreateBatchResponse>('/wire-transfers/batch', data),

  /** The file of a batch, through the authenticated client. The server marks the batch Downloaded the first time it hands the file out. */
  downloadBatchFile: (batchId: string): Promise<DownloadedFile> => fileApi.get(`/wire-transfers/batch/${batchId}/file`),

  /** Marks the batch as downloaded without handing the file out (422 `batch_already_downloaded_or_paid` once it is). */
  confirmDownload: (batchId: string) => ApiClient.post<void>(`/wire-transfers/batch/${batchId}/confirm-download`),

  /**
   * Marks the batch as paid. It cannot be undone, and it is the administrator's word: the server does not know whether the bank executed the transfers.
   * 422 `batch_not_downloaded` while the file was never handed out, `batch_already_paid` once it is.
   */
  confirmPaid: (batchId: string) => ApiClient.post<void>(`/wire-transfers/batch/${batchId}/confirm-paid`),
};
