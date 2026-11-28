import { AxiosError } from 'axios';
import axios, { handleAccountStateForbidden } from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { ApiClient } from './client';
import { acceptsRefusal } from './accept-refusal';
import { fileApi, type DownloadedFile } from './file.api';
import type { CreateBatchRequest, CreateBatchResponse, WireBatch, WireBatchPayouts, WireCurrency, WirePayout } from '@/types';

/**
 * A read that takes a refusal (403) as an answer: `null`. The shared client sends the whole app to the page of no access on a 403 for a read, and the wire page only has
 * to say that the access is not there (a role or a plan that changed since the page was drawn, or a person whose access is limited to some properties). Two 403 are not
 * that refusal: the one of an account that was deactivated and the one of a host who has not finished the onboarding. The interceptor of the client only sees the rejected
 * responses, so it never ran for them here: the handler of their own page is run from here, and the read fails like any other (the person is on their way to that page).
 * An answer with no body is a failed read, never this `null`: the page must not tell a broken answer as a refusal. Axios gives `''` for an empty body, never `undefined`.
 */
async function readOrNull<T>(path: string, params?: Record<string, string>): Promise<T | null> {
  const response = await axios.get<unknown>(path, { params, validateStatus: acceptsRefusal });
  if (response.status === 403) {
    if (handleAccountStateForbidden(response.data)) {
      throw new AxiosError('Request failed with status code 403', AxiosError.ERR_BAD_REQUEST, response.config, response.request, response);
    }
    return null;
  }
  if (response.data === null || response.data === undefined || response.data === '') throw new UnexpectedApiResponseError(path);
  return response.data as T;
}

function toWirePayout(raw: WirePayout): WirePayout {
  return {
    payoutId: raw.payoutId,
    ownerId: raw.ownerId,
    ownerName: typeof raw.ownerName === 'string' ? raw.ownerName : '',
    periodYear: raw.periodYear,
    periodMonth: raw.periodMonth,
    amount: raw.amount,
    currency: raw.currency,
    confirmedAt: raw.confirmedAt,
    status: raw.status,
    ownerHasIban: raw.ownerHasIban === true,
  };
}

function payoutsOf(data: unknown, path: string): WirePayout[] {
  if (!Array.isArray(data)) throw new UnexpectedApiResponseError(path);
  return (data as WirePayout[]).map(toWirePayout);
}

function toWireBatch(raw: unknown, path: string): WireBatch {
  if (typeof raw !== 'object' || raw === null) throw new UnexpectedApiResponseError(path);
  const batch = raw as WireBatch;
  return {
    id: batch.id,
    currency: batch.currency,
    status: batch.status,
    transferCount: batch.transferCount,
    totalAmount: batch.totalAmount,
    executionDate: batch.executionDate ?? null,
    format: batch.format ?? null,
    createdAt: batch.createdAt,
    downloadedAt: batch.downloadedAt ?? null,
    paidAt: batch.paidAt ?? null,
  };
}

function batchesOf(data: unknown, path: string): WireBatch[] {
  if (!Array.isArray(data)) throw new UnexpectedApiResponseError(path);
  return data.map((item: unknown) => toWireBatch(item, path));
}

/**
 * The wire files that pay the owners (backend `api/wire-transfers`, ADR-017, E16): the owner and the administrators of an org on the agency plan
 * (`agency.wire.manage`). A batch is made from CONFIRMED PAYOUTS (the net after the withholding), one transfer for each, one file per currency, debited from the account
 * of the issuer profile of the org: the request names no account. The list of the batches never holds an IBAN, a name or the file.
 */
export const wireTransferApi = {
  listBatches: async (): Promise<WireBatch[] | null> => {
    const path = '/wire-transfers/batches';
    const data = await readOrNull<unknown>(path);
    return data === null ? null : batchesOf(data, path);
  },

  /**
   * The payouts a wire file of ONE currency can still pay (`api/wire-transfers/payable-payouts?currency=`): confirmed, of a statement published to the owner, in no batch
   * yet, the oldest first (the server gives at most 1000). One list per currency, CHF or EUR, never both. Each one says whether the owner has an IBAN as a yes or a no. `null`
   * when the server refuses it (403: the caller reaches only some properties of the org).
   */
  listPayablePayouts: async (currency: WireCurrency): Promise<WirePayout[] | null> => {
    const path = '/wire-transfers/payable-payouts';
    const data = await readOrNull<unknown>(path, { currency });
    return data === null ? null : payoutsOf(data, path);
  },

  getBatchPayouts: async (batchId: string): Promise<WireBatchPayouts | null> => {
    const path = `/wire-transfers/batch/${batchId}/payouts`;
    const data = await readOrNull<unknown>(path);
    if (data === null) return null;
    const answer = (typeof data === 'object' ? data : {}) as { batch?: unknown; payouts?: unknown };
    if (!answer.batch) throw new UnexpectedApiResponseError(path);
    return { batch: toWireBatch(answer.batch, path), payouts: payoutsOf(answer.payouts, path) };
  },

  createBatch: (data: CreateBatchRequest) => ApiClient.post<CreateBatchResponse>('/wire-transfers/batch', data),

  downloadBatchFile: (batchId: string): Promise<DownloadedFile> => fileApi.get(`/wire-transfers/batch/${batchId}/file`),

  confirmDownload: (batchId: string) => ApiClient.post<void>(`/wire-transfers/batch/${batchId}/confirm-download`),

  confirmPaid: (batchId: string) => ApiClient.post<void>(`/wire-transfers/batch/${batchId}/confirm-paid`),
};
