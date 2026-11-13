import { ApiClient } from './client';
import { fileApi, type DownloadedFile } from './file.api';
import type { CreateBatchRequest, CreateBatchResponse } from '@/types';

/**
 * The wire files that pay the owners (backend `api/wire-transfers`, ADR-017): the owner and the administrators of an org on the agency plan
 * (`agency.wire.manage`). There is no read of the batches: what the server says of one is what the answer of each call says.
 */
export const wireTransferApi = {
  /**
   * Creates a wire file from published statements of ONE currency (EUR: SEPA, CHF: Swiss). The server checks the debit account, the owners' accounts and
   * amounts and the file against its schema before it saves anything; the refusals are 422 with a `code` (`wire_batch_schema_unavailable`: no file is made).
   */
  createBatch: (data: CreateBatchRequest) =>
    ApiClient.post<CreateBatchResponse>('/wire-transfers/batch', data),

  /** The file of a batch, through the authenticated client. The server marks the batch Downloaded the first time it hands the file out. */
  downloadBatchFile: (batchId: string): Promise<DownloadedFile> =>
    fileApi.get(`/wire-transfers/batch/${batchId}/file`),

  /**
   * Marks the batch as paid. It cannot be undone, and it is the administrator's word: the server does not know whether the bank executed the transfers.
   * 422 `batch_not_downloaded` while the file was never handed out, `batch_already_paid` once it is.
   */
  confirmPaid: (batchId: string) =>
    ApiClient.post<void>(`/wire-transfers/batch/${batchId}/confirm-paid`),
};
