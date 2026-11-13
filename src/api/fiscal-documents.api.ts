import { AxiosError, type AxiosResponse } from 'axios';
import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { withJsonErrorBody } from '@/lib/file-download';
import type {
  FiscalDocumentCriteria,
  FiscalDocumentEntry,
  FiscalDocumentExportFormat,
  FiscalDocumentFile,
  FiscalDocumentPage,
  FiscalDocumentsContext,
} from '@/types';

const PATH = '/fiscal/documents';
const SETTINGS_PATH = `${PATH}/settings`;

/** A PDF or an XML is a few hundred kB: more than the 30 s of every other call, on a connection that is not fast. */
const DOWNLOAD_TIMEOUT_MS = 120_000;

/** A file of the list is built while the server reads the documents: it may take a while on a long period. */
const EXPORT_TIMEOUT_MS = 5 * 60_000;

/**
 * The codes of the problems of the documents (`FiscalDocumentErrors`, `OctorateDocumentErrors`, the export and the FatturaPA schema): the screens tell each one in its
 * own words (`apiErrors.codes.*`). `schemaUnavailable` is the 422 of the issue while the FatturaPA schema is not installed: it is never a generic error and never a success.
 */
export const FISCAL_DOCUMENT_ERROR = {
  /** 404: no document with that id for the caller (another organization's, one out of its reach and a missing one are the same answer). */
  notFound: 'fiscal_document_not_found',
  /** 404: the document is not a CasaZen invoice or credit note that was issued, so it has no XML. */
  xmlUnavailable: 'fiscal_document_xml_unavailable',
  /** 404: the channel manager holds no PDF of the imported document, or it cannot be read now. */
  octoratePdfUnavailable: 'octorate_pdf_unavailable',
  /** 422: the FatturaPA schema is not installed yet, so no XML is made: an operator adds it. */
  schemaUnavailable: 'fatturapa_schema_unavailable',
} as const;

/**
 * A 403 is an answer of these reads, not a failure of the app: for a read the shared client sends the whole app to the no-access page, and a refusal of the documents
 * must be told in its own section with the rest of the page still there. The status is accepted here, as the ledger of the payments does, and `refusalOf` raises it again
 * as the error it is, so that the screens read it with `getHttpStatus` as any other. A 403 `account_inactive` or `onboarding_required` is not routed by these reads either:
 * the other reads of the app raise it.
 */
const acceptsRefusal = (status: number) => (status >= 200 && status < 300) || status === 403;

function refusalOf(response: AxiosResponse): AxiosError {
  return new AxiosError(`Request failed with status code ${response.status}`, AxiosError.ERR_BAD_REQUEST, response.config, response.request, response);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A member the API leaves out when it is empty: missing, `null` or a text. */
const isOptionalText = (value: unknown) => value === undefined || value === null || typeof value === 'string';

/** The text of an optional member, `null` for what is empty. */
const textOf = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/**
 * The value of a header of an answer, whatever the case of its name, or `null`. A browser lets a page read only the headers that the API exposes (CORS), so a header
 * that is not there is `null`: whoever reads it has a way on without it.
 */
function headerOf(headers: unknown, name: string): string | null {
  if (!isRecord(headers)) return null;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted && typeof value === 'string') return value;
  }
  return null;
}

/**
 * A document the screens can draw without guessing, reduced to what they show: the codes, the currency and the total are there and are of the right type. The fiscal code,
 * the VAT number, the address and the PEC of the recipient, which the API also sends, are not kept. A member that is not one is a load error for the whole answer, never a
 * row left out: a list that silently misses a document could be read as one that is in order.
 */
function entryOf(value: unknown): FiscalDocumentEntry | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.source !== 'string' ||
    typeof value.kind !== 'string' ||
    typeof value.status !== 'string' ||
    typeof value.currency !== 'string' ||
    typeof value.total !== 'number' ||
    !Number.isFinite(value.total) ||
    typeof value.paymentState !== 'string' ||
    typeof value.sdiStatus !== 'string' ||
    !isOptionalText(value.bookingId) ||
    !isOptionalText(value.number) ||
    !isOptionalText(value.issueDate) ||
    !isOptionalText(value.recipientName) ||
    !isOptionalText(value.sdiErrorCode)
  ) {
    return null;
  }
  return {
    id: value.id,
    bookingId: textOf(value.bookingId),
    source: value.source,
    kind: value.kind,
    status: value.status,
    number: textOf(value.number),
    issueDate: textOf(value.issueDate),
    currency: value.currency,
    recipientName: textOf(value.recipientName),
    total: value.total,
    paymentState: value.paymentState,
    sdiStatus: value.sdiStatus,
    sdiErrorCode: textOf(value.sdiErrorCode),
    hasXml: value.hasXml === true,
    octoratePdfAvailable: value.octoratePdfAvailable === true,
  };
}

/** A body that is not a page of documents (the SPA's `index.html` behind a wrong rewrite) is a load error, never an empty list. */
function ensurePage(data: unknown): FiscalDocumentPage {
  const page = isRecord(data) ? data : null;
  const items = page !== null && Array.isArray(page.items) ? page.items.map(entryOf) : null;
  if (
    page === null ||
    items === null ||
    items.some((item) => item === null) ||
    typeof page.totalCount !== 'number' ||
    !Number.isFinite(page.totalCount) ||
    typeof page.page !== 'number' ||
    typeof page.pageSize !== 'number'
  ) {
    throw new UnexpectedApiResponseError(PATH);
  }
  return { items: items as FiscalDocumentEntry[], totalCount: page.totalCount, page: page.page, pageSize: page.pageSize };
}

/** What is empty is not sent: the API reads a missing parameter as «no limit», and an empty one as a mistake. */
function paramsOf(criteria: FiscalDocumentCriteria): Record<string, string> {
  const params: Record<string, string> = {};
  for (const key of ['from', 'to', 'kind', 'source', 'status'] as const) {
    const value = criteria[key];
    if (value) params[key] = value;
  }
  return params;
}

/**
 * The address of the PDF of a document: the one CasaZen makes for its own documents, the one that serves the PDF the channel manager holds for an imported one (through
 * CasaZen, never as an address of the channel manager).
 */
export function pdfPathOf(document: Pick<FiscalDocumentEntry, 'id' | 'source'>): string {
  const id = encodeURIComponent(document.id);
  return document.source === 'Octorate' ? `${PATH}/${id}/octorate-pdf` : `${PATH}/${id}/pdf`;
}

async function readFile(path: string, params: object | undefined, timeout: number): Promise<FiscalDocumentFile> {
  try {
    const response = await axios.get<Blob>(path, { params, responseType: 'blob', timeout, validateStatus: acceptsRefusal });
    if (response.status === 403) throw refusalOf(response);
    return { blob: response.data, contentDisposition: headerOf(response.headers, 'content-disposition') };
  } catch (error) {
    // With `responseType: 'blob'` a problem body arrives as a Blob: parse it so that its code can be read.
    throw await withJsonErrorBody(error);
  }
}

/**
 * One page of the documents of the caller (`GET api/fiscal/documents`), newest first: `from` and `to` are Europe/Rome days of the issue, `page` counts from 1 and
 * `pageSize` is 20 when missing and 100 at most. The server narrows the list in SQL to the properties the caller reaches. Needs `payment.read`: a caller who may not
 * read payments gets a 403, which is thrown as an error with its response (no redirect to the no-access page).
 */
export async function listDocuments(criteria: FiscalDocumentCriteria, page: number, pageSize: number): Promise<FiscalDocumentPage> {
  const response = await axios.get<unknown>(PATH, { params: { ...paramsOf(criteria), page, pageSize }, validateStatus: acceptsRefusal });
  if (response.status === 403) throw refusalOf(response);
  return ensurePage(response.data);
}

/** The PDF of a document, through CasaZen: its own (`/pdf`) or the one of the channel manager (`/octorate-pdf`). */
export function downloadPdf(document: Pick<FiscalDocumentEntry, 'id' | 'source'>): Promise<FiscalDocumentFile> {
  return readFile(pdfPathOf(document), undefined, DOWNLOAD_TIMEOUT_MS);
}

/** The FatturaPA XML of an invoice or a credit note that CasaZen issued (404 `fiscal_document_xml_unavailable` for any other document). */
export function downloadXml(document: Pick<FiscalDocumentEntry, 'id'>): Promise<FiscalDocumentFile> {
  return readFile(`${PATH}/${encodeURIComponent(document.id)}/xml`, undefined, DOWNLOAD_TIMEOUT_MS);
}

/**
 * The CSV or the Excel file of the list (`GET api/fiscal/documents/export`): the issued documents only, with the same days, kind and source as the list (the file does not
 * read `status`), built now and never stored. 400 `fiscal_export_invalid_range` for days the server does not accept, 422 `csv_too_many_rows` or `xlsx_too_many_rows` for a
 * list longer than a file holds.
 */
export function exportList(format: FiscalDocumentExportFormat, criteria: FiscalDocumentCriteria): Promise<FiscalDocumentFile> {
  const { from, to, kind, source } = criteria;
  return readFile(`${PATH}/export`, { ...paramsOf({ from, to, kind, source }), format }, EXPORT_TIMEOUT_MS);
}

/**
 * How the documents of the organization are issued, as far as this page needs it (`GET api/fiscal/documents/settings`, which needs `property.read` as well as
 * `payment.read`): who issues, whether CasaZen may issue in this environment and whether it has a channel to the SDI. The data of the issuer (its VAT number, its fiscal
 * code, its address) and the name of whoever carries the invoices to the SDI are in the answer and are not kept.
 */
export async function getDocumentsContext(): Promise<FiscalDocumentsContext> {
  const response = await axios.get<unknown>(SETTINGS_PATH, { validateStatus: acceptsRefusal });
  if (response.status === 403) throw refusalOf(response);
  const data = response.data;
  if (!isRecord(data) || typeof data.casazenIssuanceEnabled !== 'boolean' || !isRecord(data.sdi) || typeof data.sdi.providerConfigured !== 'boolean') {
    throw new UnexpectedApiResponseError(SETTINGS_PATH);
  }
  return {
    mode: typeof data.mode === 'string' ? data.mode : null,
    casazenIssuanceEnabled: data.casazenIssuanceEnabled,
    sdiProviderConfigured: data.sdi.providerConfigured,
  };
}
