import { isAxiosError } from 'axios';
import { FISCAL_DOCUMENT_ERROR } from '@/api/fiscal-documents.api';
import { isFeatureEnabled, type FeatureFlags } from '@/config/feature-flags';
import { BOOKINGS_PATH } from '@/features/bookings/lib/booking-list-query';
import { contentDispositionFileName } from '@/features/document-archive/document-file';
import { getProblemCode } from '@/lib/api-errors';
import type { StatusIconName, StatusTone } from '@/lib/status-dictionary';
import { formatStayDate, isStayDate, todayInRome } from '@/lib/stay-dates';
import type { FiscalDocumentCriteria, FiscalDocumentEntry, FiscalDocumentExportFormat, FiscalDocumentsContext } from '@/types';

/** Documents on a page of the list (the page size the server uses when it is not told one). */
export const DOCUMENTS_PAGE_SIZE = 20;

/** The first and the last day a period may start or end on: the years the server accepts for the files (`HostDashboardPeriod`), and the date fields take no other. */
export const DOCUMENT_DAY_LIMITS = { min: '2000-01-01', max: '2100-12-31' } as const;

// ---------------------------------------------------------------------------------------------------------------------------------
// Money and days

/** More decimals than any currency has, so that a figure the server wrote is never cut by the format: what it sends is what is shown. */
const MAX_FRACTION_DIGITS = 4;

const CURRENCY_CODE = /^[A-Za-z]{3}$/;
const AMOUNT_FORMATS = new Map<string, Intl.NumberFormat>();

function numberFormat(language: string, currency: string | null): Intl.NumberFormat {
  const key = `${language}|${currency ?? ''}`;
  const known = AMOUNT_FORMATS.get(key);
  if (known) return known;
  const options: Intl.NumberFormatOptions = currency
    ? { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: MAX_FRACTION_DIGITS }
    : { maximumFractionDigits: MAX_FRACTION_DIGITS };
  let format: Intl.NumberFormat;
  try {
    format = new Intl.NumberFormat(language, options);
  } catch {
    // A language tag the runtime does not know: the page's own default, never a crash on a money screen.
    format = new Intl.NumberFormat('it', options);
  }
  AMOUNT_FORMATS.set(key, format);
  return format;
}

/**
 * The total of a document as the server wrote it, in the language of the person and in the currency of the document: no sum, no rounding to another unit, no conversion,
 * and never an assumed euro (a currency that is not a code is written after the number as it came). Two currencies are never in one figure.
 */
export function formatDocumentAmount(amount: number, currency: string, language: string): string {
  if (CURRENCY_CODE.test(currency)) return numberFormat(language, currency).format(amount);
  return `${numberFormat(language, null).format(amount)} ${currency}`.trim();
}

/** A day of a document (`YYYY-MM-DD`, Europe/Rome) in the language of the person; what is not a day is shown as it came. */
export function formatDocumentDay(day: string, language: string): string {
  return formatStayDate(day, language, { day: 'numeric', month: 'short', year: 'numeric' }) || day;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Filters

/** What narrows the list, as the fields of the page hold it: an empty text is «no limit». */
export interface DocumentFilters {
  from: string;
  to: string;
  kind: string;
  source: string;
  status: string;
}

export const NO_FILTERS: DocumentFilters = { from: '', to: '', kind: '', source: '', status: '' };

export function hasActiveFilters(filters: DocumentFilters): boolean {
  return Object.values(filters).some((value) => value !== '');
}

/** What the server is asked: what is empty is left out. */
export function criteriaOf(filters: DocumentFilters): FiscalDocumentCriteria {
  const criteria: FiscalDocumentCriteria = {};
  if (filters.from) criteria.from = filters.from;
  if (filters.to) criteria.to = filters.to;
  if (filters.kind) criteria.kind = filters.kind;
  if (filters.source) criteria.source = filters.source;
  if (filters.status) criteria.status = filters.status;
  return criteria;
}

/** A day the date fields and the server accept: a real day of the years the reports support. */
function isSupportedDay(day: string): boolean {
  return isStayDate(day) && day >= DOCUMENT_DAY_LIMITS.min && day <= DOCUMENT_DAY_LIMITS.max;
}

/**
 * What is wrong with the period of the filters, or `null`. `range`: a day the server would refuse (outside the years it supports, or not a day); `order`: the first day
 * is after the last. A period with a problem is not asked of the server (the list and the files would be refused or would be empty for the wrong reason): the page says why.
 */
export type PeriodProblem = 'range' | 'order';

export function periodProblemOf(filters: Pick<DocumentFilters, 'from' | 'to'>): PeriodProblem | null {
  const { from, to } = filters;
  if ((from !== '' && !isSupportedDay(from)) || (to !== '' && !isSupportedDay(to))) return 'range';
  if (from !== '' && to !== '' && from > to) return 'order';
  return null;
}

/**
 * Why the files cannot be asked now, or `null`. The files hold the issued documents only and do not read the status: with the filter on drafts or on dropped drafts there
 * is nothing to put in them (`status`), and a period with a problem is not asked (`period`).
 */
export function exportBlockOf(filters: DocumentFilters): 'period' | 'status' | null {
  if (periodProblemOf(filters) !== null) return 'period';
  return filters.status === '' || filters.status === 'Issued' ? null : 'status';
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Words of a document

/** The kinds and the sources the words are written for (the filters offer them); any other code is shown as it came. */
export const DOCUMENT_KIND_OPTIONS = ['Invoice', 'CreditNote', 'Receipt', 'Proforma'] as const;
export const DOCUMENT_SOURCE_OPTIONS = ['CasaZen', 'Octorate'] as const;
export const DOCUMENT_STATUS_OPTIONS = ['Draft', 'Issued', 'Discarded'] as const;

/** The key of the words of the kind of a document, or `null` for a kind this client has no words for (shown as it came). */
export function documentKindKey(kind: string): string | null {
  return (DOCUMENT_KIND_OPTIONS as readonly string[]).includes(kind) ? `fiscalDocuments.list.kind.${kind}` : null;
}

/** The key of the words of the source of a document, or `null` for a source this client has no words for. */
export function documentSourceKey(source: string): string | null {
  return (DOCUMENT_SOURCE_OPTIONS as readonly string[]).includes(source) ? `fiscalDocuments.list.source.${source}` : null;
}

/**
 * One state of a document in plain words, with a color and an icon (UX-09): the key of its words, its tone and its icon, and what it adds (the code the SDI gave for a
 * document it refused, or the code of a state this client does not know, shown as it came and never as a state that is complete).
 */
export interface DocumentState {
  /** The key of the words (`fiscalDocuments.list.state.*`). */
  key: string;
  tone: StatusTone;
  icon: StatusIconName;
  /** The code the SDI gave, or the unknown code that the words name. */
  detail?: string;
}

function state(key: string, tone: StatusTone, icon: StatusIconName, detail?: string): DocumentState {
  return detail === undefined ? { key: `fiscalDocuments.list.state.${key}`, tone, icon } : { key: `fiscalDocuments.list.state.${key}`, tone, icon, detail };
}

/** Every state of a document that has words, in both languages: a test checks them against the locale files. */
export const DOCUMENT_STATE_KEYS = [
  'channelManaged',
  'delivered',
  'draft',
  'discarded',
  'issued',
  'manualDeclared',
  'paid',
  'rejected',
  'sdiUnavailable',
  'submitted',
  'toCollect',
  'toSend',
  'unrecognizedPayment',
  'unrecognizedSdi',
  'unrecognizedStatus',
] as const;

/** The state of a document on the SDI, for a document CasaZen issued: only a state the SDI confirmed is «Consegnata». */
function sdiStateOf(document: FiscalDocumentEntry): DocumentState {
  switch (document.sdiStatus) {
    case 'not_applicable':
      return state('issued', 'success', 'check-circle');
    case 'to_send':
      return state('toSend', 'warning', 'send');
    case 'submitted':
      return state('submitted', 'info', 'hourglass');
    case 'delivered':
      return state('delivered', 'success', 'check-circle');
    case 'rejected':
      return state('rejected', 'danger', 'x-circle', document.sdiErrorCode ?? undefined);
    case 'manual_declared':
      return state('manualDeclared', 'info', 'send');
    case 'unknown':
      return state('sdiUnavailable', 'neutral', 'circle-dashed');
    default:
      return state('unrecognizedSdi', 'neutral', 'circle-dashed', document.sdiStatus);
  }
}

/** Whether the amount of the document was collected, or `null` when the server does not say (nothing is claimed then). */
function paymentStateOf(document: FiscalDocumentEntry): DocumentState | null {
  switch (document.paymentState) {
    case 'ToCollect':
      return state('toCollect', 'warning', 'clock');
    case 'Paid':
      return state('paid', 'success', 'euro');
    case 'Unknown':
      return null;
    default:
      return state('unrecognizedPayment', 'neutral', 'circle-dashed', document.paymentState);
  }
}

/**
 * The states of a document: the one of the document itself and, when it matters, whether it was collected, as two separate lines. A document is complete only when it is
 * issued: a draft is «Bozza», a dropped draft says so, an invoice that is not sent to the SDI says «da inviare», one the SDI refused says «Scartata dallo SDI», and a state
 * this client does not know is shown as it came. A document of the channel manager is «Gestito dal tuo channel manager» (the SDI is its business and it says nothing of it). A
 * credit note, a draft and a dropped draft have no line about collection.
 */
export function documentStatesOf(document: FiscalDocumentEntry): { main: DocumentState; payment: DocumentState | null } {
  if (document.source === 'Octorate') return { main: state('channelManaged', 'info', 'landmark'), payment: paymentStateOf(document) };
  if (document.status === 'Draft') return { main: state('draft', 'neutral', 'pencil'), payment: null };
  if (document.status === 'Discarded') return { main: state('discarded', 'neutral', 'ban'), payment: null };
  if (document.status !== 'Issued') return { main: state('unrecognizedStatus', 'neutral', 'circle-dashed', document.status), payment: null };
  return { main: sdiStateOf(document), payment: document.kind === 'CreditNote' || document.kind === 'Proforma' ? null : paymentStateOf(document) };
}

/** A document CasaZen issued that the SDI has not answered yet: the answer comes by itself, so an open list is read again. */
export function isAwaitingSdi(document: FiscalDocumentEntry): boolean {
  return document.source === 'CasaZen' && document.status === 'Issued' && document.sdiStatus === 'submitted';
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Actions

export interface DocumentActions {
  /** The PDF can be asked. */
  pdf: boolean;
  /** The FatturaPA XML can be asked (a CasaZen invoice or credit note that was issued). */
  xml: boolean;
  /** The document is the channel manager's: it is told «sola lettura» and nothing can be done to it from here. */
  readOnly: boolean;
  /** An imported document whose PDF cannot be had: the row says so. */
  pdfUnavailable: boolean;
}

/**
 * What can be done with a document. A CasaZen document that was issued has its PDF, and its XML when CasaZen holds one; a draft is not a document to download. An imported
 * document is read-only and has its PDF only when the channel manager says it holds one **and** the endpoint exists in this environment (the backend answers 404 to it while
 * `OctorateConnector` or `OctorateDocumentImport` is off: no request is made for what would be refused).
 */
export function documentActionsOf(document: FiscalDocumentEntry, flags: Partial<FeatureFlags>): DocumentActions {
  if (document.source === 'Octorate') {
    const pdf = document.octoratePdfAvailable && isFeatureEnabled(flags, 'octorateConnector') && isFeatureEnabled(flags, 'octorateDocumentImport');
    return { pdf, xml: false, readOnly: true, pdfUnavailable: !pdf };
  }
  const issued = document.status === 'Issued';
  return { pdf: issued, xml: issued && document.hasXml, readOnly: false, pdfUnavailable: false };
}

/** What a download that failed leaves out of the row: the whole document, or only its PDF or its XML. */
export type Unavailable = 'document' | 'pdf' | 'xml';

/**
 * What a failed download says is gone. A 404 is always «not found» (a query keeps its old rows when a later read fails, and a document that is not found is not one that is
 * on the list): the document itself, or, when the server names it, only its XML (`fiscal_document_xml_unavailable`) or the PDF of the channel manager
 * (`octorate_pdf_unavailable`). Any other failure leaves the row as it is: the person may ask again.
 */
export function unavailabilityOf(error: unknown): Unavailable | null {
  if (!isAxiosError(error) || error.response?.status !== 404) return null;
  const code = getProblemCode(error.response.data);
  if (code === FISCAL_DOCUMENT_ERROR.xmlUnavailable) return 'xml';
  if (code === FISCAL_DOCUMENT_ERROR.octoratePdfUnavailable) return 'pdf';
  return 'document';
}

/** The page of the booking of a document, for who may read bookings: a link that would lead to the page of the reserved access is never drawn. */
export function bookingLinkOf(document: Pick<FiscalDocumentEntry, 'bookingId'>, canReadBookings: boolean): string | null {
  return document.bookingId && canReadBookings ? `${BOOKINGS_PATH}/${encodeURIComponent(document.bookingId)}` : null;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Files

/** A name safe to save under, made of the number of the document the server gave: no slash, no space, never a name of a person. */
function slugOf(text: string): string {
  return text.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|-+$/g, '');
}

/**
 * The name a downloaded document is saved under: the one the server gave it (`Content-Disposition`, when the page may read it) or, when it cannot, `documento-A-12.pdf`
 * rebuilt from the number of the document. Never the name of the recipient, the fiscal code or the VAT number: a file name is shown in the folder of downloads and kept there.
 */
export function documentFileName(document: Pick<FiscalDocumentEntry, 'number'>, format: 'pdf' | 'xml', contentDisposition: string | null | undefined): string {
  const named = contentDispositionFileName(contentDisposition);
  if (named) return named;
  const number = document.number ? slugOf(document.number) : '';
  return `${number ? `documento-${number}` : 'documento'}.${format}`;
}

/**
 * The name a downloaded list is saved under: the one the server gave it, or `documenti-2026-10.csv` rebuilt as the server builds it, with the month of the first day of the
 * period (else of the last, else the month that is on).
 */
export function exportFileName(format: FiscalDocumentExportFormat, criteria: Pick<FiscalDocumentCriteria, 'from' | 'to'>, contentDisposition: string | null | undefined): string {
  const named = contentDispositionFileName(contentDisposition);
  if (named) return named;
  return `documenti-${(criteria.from || criteria.to || todayInRome()).slice(0, 7)}.${format}`;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Reads

/** How the last read of the list ended. `idle`: it was not asked (a caller who may not read payments, or days the server would refuse). */
export type DocumentsRead = 'idle' | 'loading' | 'ok' | 'notFound' | 'forbidden' | 'failed';

/**
 * The read of the list as the screen takes it. An error comes first, and a 404 is `notFound` even when the query still holds rows: a query keeps its old data when a later
 * read fails, and a list that is not found is not a list whose rows are the cached ones. An error is never an empty list or «all in order»: it has its own state.
 */
export function documentsReadOf(input: { enabled: boolean; isError: boolean; status: number | undefined; hasData: boolean }): DocumentsRead {
  if (!input.enabled) return 'idle';
  if (input.isError) return input.status === 404 ? 'notFound' : input.status === 403 ? 'forbidden' : 'failed';
  return input.hasData ? 'ok' : 'loading';
}

/** Who issues the documents of the organization, as far as the empty page tells it: `unknown` while the setting could not be read (nothing is claimed then). */
export type IssuerMode = 'Octorate' | 'CasaZenDirectOnly' | 'Accountant' | 'unset' | 'unknown';

export function issuerModeOf(context: FiscalDocumentsContext | undefined): IssuerMode {
  if (!context) return 'unknown';
  if (context.mode === 'Octorate' || context.mode === 'CasaZenDirectOnly' || context.mode === 'Accountant') return context.mode;
  return context.mode === null ? 'unset' : 'unknown';
}

/**
 * Whether the page says that sending to the SDI is not available yet: only when the setting says CasaZen has no channel to it (`sdiProviderConfigured` is `false`, never when
 * the setting could not be read), and where it explains something: the page has no document yet, or it has an invoice that waits to be sent.
 */
export function sdiNoteVisibleFor(context: FiscalDocumentsContext | undefined, documents: readonly FiscalDocumentEntry[]): boolean {
  return context?.sdiProviderConfigured === false && (documents.length === 0 || documents.some((document) => document.source === 'CasaZen' && document.sdiStatus === 'to_send'));
}
