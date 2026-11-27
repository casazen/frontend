import { isAxiosError } from 'axios';
import axios from '@/lib/axios';
import { getProblemCode } from '@/lib/api-errors';
import { withJsonErrorBody } from '@/lib/file-download';
import { ApiClient } from './client';
import type {
  ComplianceArchiveEntry,
  ComplianceArchiveFilters,
  ComplianceArchivePage,
  ComplianceBookingArchive,
  ComplianceReportFilters,
  ComplianceReportFormat,
  CoverageReport,
  ReceiptCoverage,
  UploadComplianceProofInput,
} from '@/types';
import { headerOf } from '@/api/response-helpers';

const PATH = '/compliance';

export const COMPLIANCE_ARCHIVE_ERROR = {
  proofNotFound: 'compliance_proof_not_found',
  bookingNotFound: 'compliance_booking_not_found',
  proofFileInvalid: 'compliance_proof_file_invalid',
  proofTypeUnsupported: 'compliance_proof_type_unsupported',
  proofTooLarge: 'compliance_proof_too_large',
  proofDayInvalid: 'compliance_proof_day_invalid',
  proofCoverageInvalid: 'compliance_proof_coverage_invalid',
  exportTooLarge: 'compliance_export_too_large',
} as const;

const DOWNLOAD_TIMEOUT_MS = 120_000;

const EXPORT_TIMEOUT_MS = 10 * 60_000;

export function complianceArchiveErrorCode(error: unknown): string | undefined {
  return isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
}

function clean<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== '')) as Partial<T>;
}

function receiptCoverageParams(day: string, propertyIds: readonly string[]): URLSearchParams {
  if (propertyIds.length === 0) throw new RangeError('An empty list of flats is not "every flat": name the flats the receipt covers.');
  const params = new URLSearchParams();
  params.set('day', day);
  for (const id of propertyIds) params.append('propertyIds', id);
  return params;
}

export interface DownloadedFile {
  blob: Blob;
  contentDisposition: string | null;
}

async function download(path: string, params: object | undefined, timeout: number, signal?: AbortSignal): Promise<DownloadedFile> {
  try {
    const res = await axios.get<Blob>(path, { params, responseType: 'blob', timeout, signal });
    return { blob: res.data, contentDisposition: headerOf(res.headers, 'content-disposition') };
  } catch (error) {
    // With `responseType: 'blob'` a problem body arrives as a Blob: parse it so that its code can be read.
    throw await withJsonErrorBody(error);
  }
}

export const complianceArchiveApi = {
  listEvidence: (filters: ComplianceArchiveFilters) =>
    ApiClient.get<ComplianceArchivePage>(`${PATH}/archive`, clean(filters)),

  getCoverageReport: (filters: ComplianceReportFilters) =>
    ApiClient.get<CoverageReport>(`${PATH}/report`, clean(filters)),

  getBookingCompliance: (bookingId: string) =>
    ApiClient.get<ComplianceBookingArchive>(`/bookings/${encodeURIComponent(bookingId)}/compliance`),

  /**
   * `GET /compliance/archive/{id}/download`: the file of a proof from the private bucket. The API answers with a redirect to a short-lived signed
   * address (or streams the file where the storage cannot sign); the request carries the token of the caller, so a plain link could not open it:
   * the browser follows the redirect itself and the page never builds a storage address.
   */
  downloadProof: (entry: Pick<ComplianceArchiveEntry, 'id'>) =>
    download(`${PATH}/archive/${encodeURIComponent(entry.id)}/download`, undefined, DOWNLOAD_TIMEOUT_MS),

  exportProofs: (from: string, to: string, propertyId?: string, signal?: AbortSignal) =>
    download(`${PATH}/archive/export`, clean({ from, to, propertyId }), EXPORT_TIMEOUT_MS, signal),

  exportCoverageReport: (format: ComplianceReportFormat, filters: ComplianceReportFilters) =>
    download(`${PATH}/report/export`, clean({ ...filters, format }), EXPORT_TIMEOUT_MS),

  /**
   * `GET /compliance/archive/proofs/coverage` (`booking.read`): what a receipt of the Alloggiati communication of `day` would prove for the flats `propertyIds`, in all and for each one:
   * the stays that arrived that day and that the receipt turns green. The host reads it before saving («Diventano in regola: N soggiorni»). Nothing is stored by asking. 404 for a flat
   * the caller does not reach, 422 for a day in the future or flats that are not acceptable.
   */
  getReceiptCoverage: (day: string, propertyIds: readonly string[], signal?: AbortSignal) =>
    ApiClient.get<ReceiptCoverage>(`${PATH}/archive/proofs/coverage`, receiptCoverageParams(day, propertyIds), { signal }),

  /**
   * `POST /compliance/archive/proofs`: uploads a proof (a PDF, a JPEG or a PNG, judged on its content by the server). The person who uploads it
   * is the caller, never a field. 201 with the proof as the archive lists it and, for an Alloggiati receipt, the flats it covers and how many stays it proves.
   * A receipt that covers more than its own flat names them all in `propertyIds` (repeated, the flat of the request included): the server reads no list as that flat alone.
   */
  uploadProof: async (input: UploadComplianceProofInput): Promise<ComplianceArchiveEntry> => {
    const body = new FormData();
    body.append('propertyId', input.propertyId);
    body.append('kind', input.kind);
    body.append('day', input.day);
    for (const id of input.propertyIds ?? []) body.append('propertyIds', id);
    body.append('file', input.file);
    const response = await axios.post<ComplianceArchiveEntry>(`${PATH}/archive/proofs`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};
