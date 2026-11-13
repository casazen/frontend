import axios from '@/lib/axios';
import { ApiClient } from './client';
import { acceptsRefusal } from './accept-refusal';
import { fileApi, type DownloadedFile } from './file.api';
import type {
  WithholdingSummary,
  RecordPaymentRequest,
} from '@/types';

/**
 * Withholding tax API (ADR-018, backend `api/withholding`): the owner and the administrators of an org on the agency plan (`agency.withholding.manage`).
 * Paths are relative to the API base URL, which already ends in `/api`. The F24 of a month is read through the owner accounting (`ownerAccountingApi.getF24`,
 * after the reconciliation says there is one): `GET withholding/f24` builds the record when there is none, and opening a page must not make one.
 */
export const withholdingApi = {
  /**
   * The withholding of the month by owner (reads the evidence of the payouts, nothing is calculated here); `null` when the server refuses it to this caller (403),
   * which the page tells instead of the whole app going to the page of no access.
   */
  getSummary: async (month: number, year: number): Promise<WithholdingSummary | null> => {
    const response = await axios.get<WithholdingSummary>('/withholding/summary', { params: { month, year }, validateStatus: acceptsRefusal });
    return response.status === 403 ? null : response.data;
  },

  /**
   * The stored F24 data of the month as a PDF (the server never builds the record for it: 404 `f24_not_found` for a month without one). The name of the
   * file comes with the answer (`Content-Disposition`).
   */
  downloadF24Pdf: (month: number, year: number): Promise<DownloadedFile> =>
    fileApi.get('/withholding/f24/pdf', { month, year }),

  /**
   * Records the payment of an F24 (`f24Id` and the day). It cannot be undone from here and it is the administrator's word.
   */
  recordPayment: (request: RecordPaymentRequest) =>
    ApiClient.post<void>('/withholding/reconcile', request),
};
