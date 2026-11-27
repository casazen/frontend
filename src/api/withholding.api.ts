import axios from '@/lib/axios';
import { ApiClient } from './client';
import { acceptsRefusal } from './accept-refusal';
import { fileApi, type DownloadedFile } from './file.api';
import type { ReportFileFormat } from './report-files';
import { getTaxFile } from './tax-file';
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

  /**
   * The data of the F24 of a month as a CSV or an Excel file (E18/F01/US01/T02, `agency.withholding.manage`): one line per tax code with the amount in euro and the due date, then the breakdown per owner and payout, from the
   * evidence of the payouts paid in the month. It neither makes nor changes the F24 record, and it is not a telematic file: the payment and the filing stay with the agency or its accountant. 422 `tax_no_obligations` for a
   * month without any decision. It is not behind the flag of the tax exports.
   */
  downloadF24Data: (year: number, month: number, format: ReportFileFormat): Promise<DownloadedFile> => getTaxFile(`/withholding/f24/${year}/${month}/export`, { format }),

  /**
   * The annual Certificazione Unica data of the year as a CSV or an Excel file (E18/F01/US02/T01, behind `taxReportingExports`, `agency.owner.financial.manage` on top: it names the fiscal code and the address of the
   * owners): one row for each recipient, then its stays. It is the data the agency stored, never recomputed and never a telematic file. 404 `tax_dataset_not_found` while the annual data of the year was not generated,
   * 422 `tax_cu_dataset_outdated` for data generated before the recipients were stored.
   */
  downloadCuData: (year: number, format: ReportFileFormat): Promise<DownloadedFile> => getTaxFile(`/withholding/annual/${year}/export`, { format }),

  /**
   * The draft «prospetto CU» of one owner for the year as a PDF (same permissions as the CU data), with the watermark that says it is a draft and not the Certificazione Unica. 404 `tax_dataset_not_found`,
   * `tax_cu_record_not_found` (an owner with no record), 422 `tax_cu_dataset_outdated`.
   */
  downloadCuProspect: (year: number, ownerId: string): Promise<DownloadedFile> => getTaxFile(`/withholding/annual/${year}/owners/${encodeURIComponent(ownerId)}/pdf`),

  /**
   * The data of the 770 for the year as a CSV or an Excel file (E18/F01/US02/T02, behind `taxReportingExports`): for each month and tax code the withholding made and the F24 it was paid with. The data the accountant
   * enters in the form, never the form. 422 `tax_no_obligations` for a year with no decision.
   */
  download770Data: (year: number, format: ReportFileFormat): Promise<DownloadedFile> => getTaxFile(`/withholding/770/${year}/export`, { format }),

  /**
   * The communication of the short-let contracts of the year as a CSV or an Excel file (E18/F01/US02/T02, behind `taxReportingExports`, `agency.owner.financial.manage` on top): every qualifying short let the agency
   * handled and did not withhold on, with the lessor, the property and the consideration. Due by 30 June of the next year: nothing is sent by CasaZen.
   */
  downloadContractsCommunication: (year: number, format: ReportFileFormat): Promise<DownloadedFile> =>
    getTaxFile(`/withholding/contracts-communication/${year}/export`, { format }),
};
