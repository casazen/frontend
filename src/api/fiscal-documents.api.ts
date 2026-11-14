import { AxiosError, type AxiosResponse } from 'axios';
import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { withJsonErrorBody } from '@/lib/file-download';
import type {
  BookingFiscalDocument,
  FiscalCreditNoteRequest,
  FiscalDocumentBatchResult,
  FiscalDocumentBatchRow,
  FiscalDocumentChange,
  FiscalDocumentCriteria,
  FiscalDocumentDetail,
  FiscalDocumentEntry,
  FiscalDocumentExportFormat,
  FiscalDocumentFile,
  FiscalDocumentIssuer,
  FiscalDocumentLine,
  FiscalDocumentPage,
  FiscalDocumentsContext,
} from '@/types';

const PATH = '/fiscal/documents';
const SETTINGS_PATH = `${PATH}/settings`;

/** The most documents the server gives in a page of the list. */
const MAX_PAGE_SIZE = 100;

/** The most pages read to find the drafts of a period: a period with this many drafts that are not for a bulk issue is told as having more. */
const MAX_DRAFT_PAGES = 10;

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

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** A whole number the API leaves out when it has none: anything else is read as none (a member this client does not need must never fail the whole answer). */
const integerOf = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) ? value : null);

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
    series: textOf(value.series),
    sequenceNumber: integerOf(value.sequenceNumber),
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

/** A line of a document: the amounts are the ones stored (net of VAT), the type and the VAT of the line only when the server says them. */
function lineOf(value: unknown): FiscalDocumentLine | null {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.lineNumber) ||
    typeof value.description !== 'string' ||
    !isFiniteNumber(value.quantity) ||
    !isFiniteNumber(value.unitPrice) ||
    !isFiniteNumber(value.totalPrice) ||
    !isFiniteNumber(value.vatRatePercent)
  ) {
    return null;
  }
  return {
    lineNumber: value.lineNumber,
    description: value.description,
    quantity: value.quantity,
    unitPrice: value.unitPrice,
    totalPrice: value.totalPrice,
    vatRatePercent: value.vatRatePercent,
    vatNatureCode: textOf(value.vatNatureCode),
    lineType: textOf(value.lineType),
    vatAmount: isFiniteNumber(value.vatAmount) ? value.vatAmount : null,
  };
}

/** The issuer of the snapshot when the answer carries one: its name, its VAT number and its country, and nothing else of it. */
function issuerOf(value: unknown): FiscalDocumentIssuer | null {
  if (!isRecord(value)) return null;
  const legalName = textOf(value.legalName);
  const vatNumber = textOf(value.swissVatNumber) ?? textOf(value.vatNumber);
  const country = textOf(value.country) ?? textOf(value.countryCode);
  return legalName !== null || vatNumber !== null || country !== null ? { legalName, vatNumber, country } : null;
}

/**
 * One document with its lines, reduced like the list: the recipient is kept by name only (its fiscal code, VAT number, address and PEC are in the answer and are not kept). A member that
 * is not one is a load error for the whole answer, never a line left out: a document that silently misses a line would show a total that does not add up.
 */
function detailOf(value: unknown): FiscalDocumentDetail | null {
  const entry = entryOf(value);
  if (
    entry === null ||
    !isRecord(value) ||
    !isFiniteNumber(value.taxableBase) ||
    !isFiniteNumber(value.vatAmount) ||
    !isFiniteNumber(value.stampDuty) ||
    !Array.isArray(value.lines)
  ) {
    return null;
  }
  const lines = value.lines.map(lineOf);
  if (lines.some((line) => line === null)) return null;
  return {
    ...entry,
    taxableBase: value.taxableBase,
    vatAmount: value.vatAmount,
    stampDuty: value.stampDuty,
    lines: (lines as FiscalDocumentLine[]).sort((a, b) => a.lineNumber - b.lineNumber),
    paymentChannel: textOf(value.paymentChannel),
    issuer: issuerOf(value.issuer),
  };
}

/** What a write answers: the document and its number. An answer that is not a document is no failure of the write (the write was done): the screens read the list again. */
function changeOf(value: unknown): FiscalDocumentChange | null {
  return isRecord(value) && typeof value.id === 'string' ? { id: value.id, number: textOf(value.number) } : null;
}

function batchRowOf(value: unknown): FiscalDocumentBatchRow | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.issued !== 'boolean' || !isOptionalText(value.number) || !isOptionalText(value.errorCode)) return null;
  return { id: value.id, issued: value.issued, number: textOf(value.number), errorCode: textOf(value.errorCode) };
}

/**
 * The answer of a bulk issue. What was issued and what was not is what the ROWS say, one per document: the counts are made from them, so a count can never say «all issued» over a row
 * that failed. An answer that is not rows is a load error: it is never read as a success.
 */
function batchResultOf(data: unknown): FiscalDocumentBatchResult | null {
  if (!isRecord(data) || !Array.isArray(data.rows)) return null;
  const rows = data.rows.map(batchRowOf);
  if (rows.some((row) => row === null)) return null;
  const kept = rows as FiscalDocumentBatchRow[];
  const remaining = integerOf(data.remaining);
  return {
    rows: kept,
    issued: kept.filter((row) => row.issued).length,
    failed: kept.filter((row) => !row.issued).length,
    remaining: remaining !== null && remaining > 0 ? remaining : 0,
  };
}

function bookingDocumentOf(value: unknown): BookingFiscalDocument | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.kind !== 'string' ||
    typeof value.status !== 'string' ||
    !isFiniteNumber(value.total) ||
    typeof value.currency !== 'string' ||
    typeof value.paymentState !== 'string' ||
    !isOptionalText(value.number) ||
    !isOptionalText(value.issueDate)
  ) {
    return null;
  }
  return {
    id: value.id,
    kind: value.kind,
    status: value.status,
    number: textOf(value.number),
    total: value.total,
    currency: value.currency,
    paymentState: value.paymentState,
    issueDate: textOf(value.issueDate),
  };
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
  const issuer = isRecord(data.issuer) ? data.issuer : null;
  const series = issuer?.guestDocumentSeries ?? issuer?.defaultSeries;
  return {
    mode: typeof data.mode === 'string' ? data.mode : null,
    casazenIssuanceEnabled: data.casazenIssuanceEnabled,
    sdiProviderConfigured: data.sdi.providerConfigured,
    // The setting says the pattern of the series (empty: the year); an answer without the issuer says nothing of it.
    guestDocumentSeries: issuer === null ? null : typeof series === 'string' ? series.trim() : '',
  };
}

/**
 * One document with its lines (`GET api/fiscal/documents/{id}`), reduced to what the detail shows. Like the list it needs `payment.read`, and a 403 is thrown as the refusal it is (no redirect
 * to the no-access page); a document of another organization, one out of the reach of the caller and a missing one are all a 404.
 */
export async function getDocument(id: string): Promise<FiscalDocumentDetail> {
  const path = `${PATH}/${encodeURIComponent(id)}`;
  const response = await axios.get<unknown>(path, { validateStatus: acceptsRefusal });
  if (response.status === 403) throw refusalOf(response);
  const detail = detailOf(response.data);
  if (detail === null) throw new UnexpectedApiResponseError(path);
  return detail;
}

/**
 * The draft of a booking (`POST api/fiscal/documents`), or the one it has, made again. The writes need `payment.write` and the `FiscalDocumentIssuance` flag of the server (404 while it is
 * off); the answer says why a document cannot be made with a code (`document_invoice_data_missing`, `document_rule_not_configured`, `issuer_profile_incomplete`...).
 */
export async function createDraft(bookingId: string): Promise<FiscalDocumentChange | null> {
  const response = await axios.post<unknown>(PATH, { bookingId });
  return changeOf(response.data);
}

/** The draft made again from the current price and data of its booking (`POST api/fiscal/documents/{id}/refresh`). */
export async function refreshDraft(id: string): Promise<FiscalDocumentChange | null> {
  const response = await axios.post<unknown>(`${PATH}/${encodeURIComponent(id)}/refresh`);
  return changeOf(response.data);
}

/**
 * The draft issued (`POST api/fiscal/documents/{id}/issue`): the server gives it its number. The confirmation the server asks for is the host pressing «Emetti» in the dialog, so it goes in the
 * body here and nowhere else. 409 `document_draft_outdated` when the rule or the data of the issuer changed since the draft was made: the host refreshes it first.
 */
export async function issueDocument(id: string): Promise<FiscalDocumentChange | null> {
  const response = await axios.post<unknown>(`${PATH}/${encodeURIComponent(id)}/issue`, { confirm: true });
  return changeOf(response.data);
}

/**
 * A credit note of an issued document (`POST api/fiscal/documents/{id}/credit-note`), issued at once in its series: the whole document when `amount` is left out. The server checks that
 * the amount is above zero and not above what is left to credit (422 `credit_amount_exceeds`), and that the document can be credited at all (422 `document_not_creditable`).
 */
export async function createCreditNote(id: string, request: FiscalCreditNoteRequest): Promise<FiscalDocumentChange | null> {
  const body = request.amount === undefined ? { reason: request.reason, confirm: true } : { amount: request.amount, reason: request.reason, confirm: true };
  const response = await axios.post<unknown>(`${PATH}/${encodeURIComponent(id)}/credit-note`, body);
  return changeOf(response.data);
}

/** The draft discarded (`DELETE api/fiscal/documents/{id}`): no number was consumed. */
export async function discardDraft(id: string): Promise<void> {
  await axios.delete(`${PATH}/${encodeURIComponent(id)}`);
}

/**
 * The bulk issue (`POST api/fiscal/documents/issue-batch`) of the drafts named, at most 200 at a time: each one through the issue path of the API in its own transaction. The answer has one row
 * per document and says why each one that failed did; an empty selection is a 422 and is never read as «all».
 */
export async function issueBatch(documentIds: readonly string[]): Promise<FiscalDocumentBatchResult> {
  const path = `${PATH}/issue-batch`;
  const response = await axios.post<unknown>(path, { documentIds });
  const result = batchResultOf(response.data);
  if (result === null) throw new UnexpectedApiResponseError(path);
  return result;
}

/**
 * The drafts of the filters of the list that a bulk issue takes, at most `limit` of them, newest first: `isEligible` says which of the drafts the screen offers. `more` is true when there are drafts
 * beyond the limit (or beyond the pages this reads), so the screen can say that it did not take them all.
 */
export async function listDraftsForBatch(
  criteria: FiscalDocumentCriteria,
  isEligible: (document: FiscalDocumentEntry) => boolean,
  limit: number,
): Promise<{ drafts: FiscalDocumentEntry[]; more: boolean }> {
  const drafts: FiscalDocumentEntry[] = [];
  for (let page = 1; page <= MAX_DRAFT_PAGES; page += 1) {
    const result = await listDocuments({ ...criteria, status: 'Draft' }, page, MAX_PAGE_SIZE);
    for (const item of result.items) {
      if (!isEligible(item)) continue;
      if (drafts.length === limit) return { drafts, more: true };
      drafts.push(item);
    }
    if (result.items.length === 0 || page * MAX_PAGE_SIZE >= result.totalCount) return { drafts, more: false };
  }
  return { drafts, more: true };
}

/**
 * The documents of a booking (`GET api/bookings/{id}/fiscal-documents`), newest first, a discarded draft not among them: what the card of the tab Pagamento shows. It needs `payment.read` and the
 * booking must be one the caller reaches (404 for any other). A 403 is thrown as the refusal it is, as for the list.
 */
export async function listBookingDocuments(bookingId: string): Promise<BookingFiscalDocument[]> {
  const path = `/bookings/${encodeURIComponent(bookingId)}/fiscal-documents`;
  const response = await axios.get<unknown>(path, { validateStatus: acceptsRefusal });
  if (response.status === 403) throw refusalOf(response);
  const documents = Array.isArray(response.data) ? response.data.map(bookingDocumentOf) : null;
  if (documents === null || documents.some((document) => document === null)) throw new UnexpectedApiResponseError(path);
  return documents as BookingFiscalDocument[];
}
