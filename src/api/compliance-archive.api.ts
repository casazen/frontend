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
  UploadComplianceProofInput,
} from '@/types';

const PATH = '/compliance';

/** The codes of the problems of the archive (`ComplianceArchiveErrorCodes`): the screens tell each one in its own words. */
export const COMPLIANCE_ARCHIVE_ERROR = {
  /** 404: no proof with that id for the caller (another org's, one out of its reach, an unknown one and a tax receipt without `payment.read` are the same answer). */
  proofNotFound: 'compliance_proof_not_found',
  /** 404: no stay with that id for the caller. */
  bookingNotFound: 'compliance_booking_not_found',
  /** 422: the proof has no file, or an empty one. */
  proofFileInvalid: 'compliance_proof_file_invalid',
  /** 415: the file is not a PDF, a JPEG or a PNG, whatever its name says. */
  proofTypeUnsupported: 'compliance_proof_type_unsupported',
  /** 413: the file is larger than the limit of the server. */
  proofTooLarge: 'compliance_proof_too_large',
  /** 422: the day of the proof is in the future or before the first supported year. */
  proofDayInvalid: 'compliance_proof_day_invalid',
  /** 422: the period holds more proofs than one export carries. */
  exportTooLarge: 'compliance_export_too_large',
} as const;

/** A proof is a PDF or a photo of a few MB: more than the 30 s of every other call, on a connection that is not fast. */
const DOWNLOAD_TIMEOUT_MS = 120_000;

/** The ZIP of a period is built while the server reads the files one by one: it may take minutes. */
const EXPORT_TIMEOUT_MS = 10 * 60_000;

/** The code of the problem a failed call carries (a JSON body that `withJsonErrorBody` has parsed), or `undefined`. */
export function complianceArchiveErrorCode(error: unknown): string | undefined {
  return isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The value of a header of an answer, whatever the case of its name, or `null`. A browser lets a page read only the headers that the API exposes
 * (CORS), so a header that is not there is `null`: whoever reads it has a way on without it.
 */
function headerOf(headers: unknown, name: string): string | null {
  if (!isRecord(headers)) return null;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted && typeof value === 'string') return value;
  }
  return null;
}

/** What is empty is not sent: the API reads a missing parameter as «no limit», and an empty one as a mistake. */
function clean<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== '')) as Partial<T>;
}

/** A file the API sent back: its bytes and the name it gave it (`Content-Disposition`, when the page may read it). */
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

/**
 * The archive of the proofs CasaZen holds (NF-47, NF-52, CHK-08): the files, the coverage report, the send log of a stay and the audit exports.
 * It holds only what CasaZen owns: where an outcome lives only in the area of the channel manager the report says so and proves nothing.
 */
export const complianceArchiveApi = {
  /** `GET /compliance/archive`: the proofs held, newest first, one page of them. */
  listEvidence: (filters: ComplianceArchiveFilters) =>
    ApiClient.get<ComplianceArchivePage>(`${PATH}/archive`, clean(filters)),

  /** `GET /compliance/report` (404 while the traffic light is off): the obligations of the period, the incomplete ones included. */
  getCoverageReport: (filters: ComplianceReportFilters) =>
    ApiClient.get<CoverageReport>(`${PATH}/report`, clean(filters)),

  /** `GET /bookings/{bookingId}/compliance`: the proofs of a stay and the log of what was sent for it, by whom. */
  getBookingCompliance: (bookingId: string) =>
    ApiClient.get<ComplianceBookingArchive>(`/bookings/${encodeURIComponent(bookingId)}/compliance`),

  /**
   * `GET /compliance/archive/{id}/download`: the file of a proof from the private bucket. The API answers with a redirect to a short-lived signed
   * address (or streams the file where the storage cannot sign); the request carries the token of the caller, so a plain link could not open it:
   * the browser follows the redirect itself and the page never builds a storage address.
   */
  downloadProof: (entry: Pick<ComplianceArchiveEntry, 'id'>) =>
    download(`${PATH}/archive/${encodeURIComponent(entry.id)}/download`, undefined, DOWNLOAD_TIMEOUT_MS),

  /** `GET /compliance/archive/export`: a ZIP of every proof of the period (both days included, at most 24 months) and an index, built now and never stored. */
  exportProofs: (from: string, to: string, propertyId?: string, signal?: AbortSignal) =>
    download(`${PATH}/archive/export`, clean({ from, to, propertyId }), EXPORT_TIMEOUT_MS, signal),

  /** `GET /compliance/report/export` (404 while the traffic light is off): the coverage report as a PDF or a CSV, built now and never stored. */
  exportCoverageReport: (format: ComplianceReportFormat, filters: ComplianceReportFilters) =>
    download(`${PATH}/report/export`, clean({ ...filters, format }), EXPORT_TIMEOUT_MS),

  /**
   * `POST /compliance/archive/proofs`: uploads a proof (a PDF, a JPEG or a PNG, judged on its content by the server). The person who uploads it
   * is the caller, never a field. 201 with the proof as the archive lists it.
   */
  uploadProof: async (input: UploadComplianceProofInput): Promise<ComplianceArchiveEntry> => {
    const body = new FormData();
    body.append('propertyId', input.propertyId);
    body.append('kind', input.kind);
    body.append('day', input.day);
    body.append('file', input.file);
    const response = await axios.post<ComplianceArchiveEntry>(`${PATH}/archive/proofs`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};
