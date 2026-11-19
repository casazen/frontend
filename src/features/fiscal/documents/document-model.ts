import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import { FISCAL_DOCUMENT_ERROR } from '@/api/fiscal-documents.api';
import { isFeatureEnabled, type FeatureFlags } from '@/config/feature-flags';
import { BOOKINGS_PATH } from '@/features/bookings/lib/booking-list-query';
import { contentDispositionFileName } from '@/features/document-archive/document-file';
import { getProblemCode, translateErrorCode } from '@/lib/api-errors';
import type { StatusIconName, StatusTone } from '@/lib/status-dictionary';
import { formatStayDate, isStayDate, todayInRome } from '@/lib/stay-dates';
import {
  FISCAL_DOCUMENT_LINE_TYPES,
  FISCAL_DOCUMENT_SDI_STATUSES,
  type BookingFiscalDocument,
  type FiscalCreditNoteRequest,
  type FiscalDocumentBatchResult,
  type FiscalDocumentCriteria,
  type FiscalDocumentDetail,
  type FiscalDocumentEntry,
  type FiscalDocumentExportFormat,
  type FiscalDocumentsContext,
  type SdiDeclaration,
  type SdiScope,
  type SdiSubmitResult,
} from '@/types';

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

/** Whether a currency of the server is a code (`EUR`): without one an amount is written with no symbol, and the screen that shows it says so in words. */
export function hasCurrencyCode(currency: string): boolean {
  return CURRENCY_CODE.test(currency);
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

/** The state of a document on the SDI, for a document CasaZen issued: only a state the SDI confirmed is «Consegnata». The panel of the SDI writes the state the server answers with the same words as the list. */
export function sdiStateOf(document: Pick<FiscalDocumentEntry, 'sdiStatus' | 'sdiErrorCode'>): DocumentState {
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

/**
 * Whether the amount of the document was collected, or `null` when the server does not say (nothing is claimed then). The icon of «Pagata» is a check and never a euro sign: the
 * document may be in francs, and a currency symbol is only ever the one of the data.
 */
function paymentStateOf(document: Pick<FiscalDocumentEntry, 'paymentState'>): DocumentState | null {
  switch (document.paymentState) {
    case 'ToCollect':
      return state('toCollect', 'warning', 'clock');
    case 'Paid':
      return state('paid', 'success', 'check-circle');
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

/** What a download that failed leaves out of the row: the whole document, or only its XML. */
export type Unavailable = 'document' | 'xml';

/**
 * What a failed download says is gone. A 404 is always «not found» (a query keeps its old rows when a later read fails, and a document that is not found is not one that is
 * on the list): the document itself, or, when the server names it, only its XML (`fiscal_document_xml_unavailable`). Any other failure leaves the row as it is: the person may
 * ask again. That holds for `octorate_pdf_unavailable` too: the server sends it also when the channel manager could not be read just now (not only when it holds no PDF), so
 * the PDF button stays and the message of the code is all that is said; whether the channel manager holds a PDF at all is the `octoratePdfAvailable` of the list.
 */
export function unavailabilityOf(error: unknown): Unavailable | null {
  if (!isAxiosError(error) || error.response?.status !== 404) return null;
  const code = getProblemCode(error.response.data);
  if (code === FISCAL_DOCUMENT_ERROR.xmlUnavailable) return 'xml';
  if (code === FISCAL_DOCUMENT_ERROR.octoratePdfUnavailable) return null;
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

// ---------------------------------------------------------------------------------------------------------------------------------
// Names and write actions (E12/F02/US01/T01)

/** The words of the kind of a document; a kind this client has no words for (the server is newer) is shown as it came. */
export function documentKindWords(t: TFunction, kind: string): string {
  const key = documentKindKey(kind);
  return key ? t(key) : kind;
}

/** What names a document: its kind and the number the server gave it (a draft has none, and says so). */
export function documentNameOf(t: TFunction, document: Pick<FiscalDocumentEntry, 'kind' | 'number'>): string {
  const kind = documentKindWords(t, document.kind);
  return document.number ? t('fiscalDocuments.list.named', { kind, number: document.number }) : t('fiscalDocuments.list.unnumbered', { kind });
}

/** What names a document to a person who has several of them in front: its name and, when it has one, the recipient (a list of drafts has no number to tell them apart by). */
export function documentLabelOf(t: TFunction, document: Pick<FiscalDocumentEntry, 'kind' | 'number' | 'recipientName'>): string {
  const name = documentNameOf(t, document);
  return document.recipientName ? `${name} · ${document.recipientName}` : name;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// What a document is for, and the SDI (E17/F03/US01/T02)

/** The purposes the words are written for (backend `FiscalDocumentPurpose`); any other one is shown as it came. */
export const DOCUMENT_PURPOSES = ['GuestStay', 'OwnerInvoice', 'SelfBilling'] as const;

/** The key of the words of the purpose of a document, or `null` for a purpose this client has no words for and for a document the server gave none (nothing is claimed then). */
export function documentPurposeKey(purpose: string | undefined): string | null {
  return purpose !== undefined && (DOCUMENT_PURPOSES as readonly string[]).includes(purpose) ? `fiscalDocuments.list.purpose.${purpose}` : null;
}

/** A document of a stay of a guest: the one the endpoints of the guest documents change. A server that says no purpose is an older one, and its documents are the guests'. */
export function isGuestPurpose(purpose: string | undefined): boolean {
  return purpose === undefined || purpose === 'GuestStay';
}

/** Whose endpoints the SDI of a document is read and changed through: an owner invoice has its own, every other document is on the fiscal documents. */
export function sdiScopeOf(document: Pick<FiscalDocumentEntry, 'purpose'>): SdiScope {
  return document.purpose === 'OwnerInvoice' ? 'owner' : 'guest';
}

/** The states of a document towards the SDI that have a panel: the invoice is on its way, or was answered, or was declared. A receipt and a Swiss document (`not_applicable`) have none, and one the server says nothing of (`unknown`) neither. */
const SDI_PANEL_STATES: readonly string[] = ['to_send', 'submitted', 'delivered', 'rejected', 'manual_declared'];

/**
 * Whether the SDI panel is drawn for a document: an electronic invoice or credit note CasaZen issued (an imported document is the channel manager's, its SDI is its business), in a state of the SDI that has
 * something to say. A state this client does not know is drawn too, read-only (the panel says it as it came, and never as a state that is complete).
 */
export function isSdiDocument(document: Pick<FiscalDocumentEntry, 'source' | 'status' | 'sdiStatus'>): boolean {
  if (document.source !== 'CasaZen' || document.status !== 'Issued') return false;
  return SDI_PANEL_STATES.includes(document.sdiStatus) || !(FISCAL_DOCUMENT_SDI_STATUSES as readonly string[]).includes(document.sdiStatus);
}

/** What the answer of «Invia» says. `submitted` is said only when the channel took the file AND the state the server answers is `submitted`: anything the server does not confirm is `unconfirmed`, never a success. */
export type SubmitVerdict = 'submitted' | 'alreadySubmitted' | 'refused' | 'notConfigured' | 'unconfirmed';

export function submitVerdictOf(result: SdiSubmitResult): SubmitVerdict {
  switch (result.outcome) {
    case 'Submitted':
      return result.state.status === 'submitted' ? 'submitted' : 'unconfirmed';
    case 'AlreadySubmitted':
      return 'alreadySubmitted';
    case 'Refused':
      return 'refused';
    case 'NotConfigured':
      return 'notConfigured';
    default:
      return 'unconfirmed';
  }
}

/** What a link to the page asks of a document (`?document=<id>&step=correct|review`, the «Do now» of a «To do» item): the document opens, and the guided correction at once when it says `correct`. */
export type DocumentIntent = 'correct' | 'review';

const DOCUMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The document and the step an address names; what is not an id or a known step is nothing (a hand-made address opens no document and no step). */
export function documentLinkOf(params: URLSearchParams): { documentId: string | null; intent: DocumentIntent | undefined } {
  const id = params.get('document') ?? '';
  const step = params.get('step');
  return { documentId: DOCUMENT_ID.test(id) ? id : null, intent: step === 'correct' || step === 'review' ? step : undefined };
}

/** The longest reference of a sending and the longest code of a rejection the server keeps (it refuses more with 422 `sdi_declaration_invalid`). */
export const SDI_REFERENCE_MAX = 255;
export const SDI_ERROR_CODE_MAX = 20;
export const SDI_ERROR_TEXT_MAX = 500;

/** What the dialog of the declaration holds: what is declared, and the fields of each kind as typed. */
export interface SdiDeclareForm {
  kind: 'Sent' | 'Rejected';
  date: string;
  reference: string;
  errorCode: string;
  errorText: string;
}

export type SdiDeclareField = 'date' | 'reference' | 'errorCode';

/**
 * What is wrong with the declaration before it is asked of the server, by field: the day of the sending is required, not in the future (Europe/Rome) and not before the day the document was issued; its
 * reference is required; the code of a rejection is required and short. The server checks the same (422 `sdi_declaration_invalid`), so a refusal that names fields is shown on them too.
 */
export function declareProblemsOf(form: SdiDeclareForm, context: { today: string; issueDate: string | null }): SdiDeclareField[] {
  const problems: SdiDeclareField[] = [];
  if (form.kind === 'Sent') {
    const { today, issueDate } = context;
    if (!isStayDate(form.date) || form.date > today || (issueDate !== null && form.date < issueDate)) problems.push('date');
    const reference = form.reference.trim();
    if (reference === '' || reference.length > SDI_REFERENCE_MAX) problems.push('reference');
  } else {
    const code = form.errorCode.trim();
    if (code === '' || code.length > SDI_ERROR_CODE_MAX) problems.push('errorCode');
  }
  return problems;
}

/** The declaration as the server is asked for it: what is typed, cut at its ends. */
export function declarationOf(form: SdiDeclareForm): SdiDeclaration {
  if (form.kind === 'Sent') return { kind: 'Sent', date: form.date, reference: form.reference.trim() };
  const text = form.errorText.trim().slice(0, SDI_ERROR_TEXT_MAX);
  return { kind: 'Rejected', errorCode: form.errorCode.trim(), ...(text === '' ? {} : { errorText: text }) };
}

/** The fields a 422 `sdi_declaration_invalid` names (`fields`): only the ones the dialog has. */
export function declareRefusedFieldsOf(error: unknown): SdiDeclareField[] {
  if (!isAxiosError(error) || error.response?.status !== 422) return [];
  const data: unknown = error.response.data;
  if (typeof data !== 'object' || data === null || getProblemCode(data) !== 'sdi_declaration_invalid') return [];
  const fields = (data as { fields?: unknown }).fields;
  return Array.isArray(fields) ? fields.filter((field): field is SdiDeclareField => field === 'date' || field === 'reference' || field === 'errorCode') : [];
}

/** What a person with the right to write payments may do with a document, on top of what it offers to everybody (`documentActionsOf`). */
export interface DocumentWriteActions {
  /** A draft is issued. */
  issue: boolean;
  /** A draft is made again from the booking. */
  refresh: boolean;
  /** A draft is dropped: it consumed no number. */
  discard: boolean;
  /** An invoice or a receipt that was issued is credited, in whole or in part. */
  credit: boolean;
}

const NO_WRITE_ACTIONS: DocumentWriteActions = { issue: false, refresh: false, discard: false, credit: false };

/**
 * What can be changed in a document. `canWrite` is the right to write payments (`payment.write`) AND the flag of the issuance of CasaZen: without either of them nothing can be
 * changed, whatever the document is. Only a document CasaZen issues can be changed (an imported one is read-only). A draft is issued, dropped or, when it is made from a booking, made
 * again (a credit note that is still a draft is the amounts of the document it credits: there is nothing to make it again from). An invoice or a receipt that was issued is credited;
 * a credit note and a proforma never are. Two documents are the exception, because the server refuses the action for them every time: an invoice the SDI rejected never was issued, so it is corrected (from its panel
 * of the SDI) and never credited (422 `document_rejected_use_correction`); the draft that replaces it holds its number, so it is issued and never dropped (422 `document_replacement_holds_number`).
 */
export function documentWriteActionsOf(document: Pick<FiscalDocumentEntry, 'source' | 'status' | 'kind' | 'purpose' | 'sdiStatus' | 'replacesDocumentId'>, canWrite: boolean): DocumentWriteActions {
  // An invoice of the property manager to an owner and a self-billed invoice are never changed with the endpoints of the guest documents (the server refuses with 422): their own pages change them.
  if (!canWrite || document.source !== 'CasaZen' || !isGuestPurpose(document.purpose)) return NO_WRITE_ACTIONS;
  const draft = document.status === 'Draft';
  const rejected = document.sdiStatus === 'rejected';
  const holdsANumber = Boolean(document.replacesDocumentId);
  return {
    issue: draft,
    refresh: draft && document.kind !== 'CreditNote',
    discard: draft && !holdsANumber,
    credit: document.status === 'Issued' && (document.kind === 'Invoice' || document.kind === 'Receipt') && !rejected,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Numbering: the series and the number a document will have

/**
 * The series a document issued on `day` gets, from the pattern of the setting (`{year}` stands for the year of the issue; an empty pattern is the year, the rule of the server), or `null`
 * while the pattern is not known: nothing is claimed about a series that could not be read.
 */
export function seriesOf(pattern: string | null | undefined, day: string): string | null {
  if (pattern === null || pattern === undefined) return null;
  const effective = pattern.trim() === '' ? '{year}' : pattern.trim();
  return effective.split('{year}').join(day.slice(0, 4));
}

/** What the numbering needs of an issued document: its series, its number in it and the number as written. */
export interface NumberedDocument {
  series: string | null;
  sequenceNumber: number | null;
  number: string | null;
}

/** The numbering of a series as far as the issued documents show it: the last number used and the one that comes after it (`null` when it cannot be told). */
export interface Numbering {
  series: string | null;
  last: string | null;
  next: string | null;
}

/**
 * The number the next document of the series is expected to get: the one after the highest number the issued documents have in it (`series/number`, the way the server writes it). It is an
 * expectation and says so: the server gives the number when it issues, in order and with no gaps, and another document may be issued before this one. While the series is not known nothing is
 * expected, and only the last number issued is told. Nothing is expected either, and never «the first number», when none of the documents read is in the series: the list a person reads may leave
 * documents out (a person who reaches only some of the properties, the newest 100) and the counter of the server starts above the numbers already used, so an empty series here proves nothing there.
 */
export function numberingOf(series: string | null, issued: readonly NumberedDocument[] | undefined): Numbering {
  // The issued documents could not be read (yet): nothing is expected, and above all never «the first number of the series».
  if (issued === undefined) return { series, last: null, next: null };
  const numbered = issued.filter((document) => document.sequenceNumber !== null);
  if (series === null) {
    const latest = issued.find((document) => document.number !== null);
    return { series: null, last: latest?.number ?? null, next: null };
  }
  const inSeries = numbered.filter((document) => document.series === series);
  if (inSeries.length === 0) return { series, last: null, next: null };
  const highest = inSeries.reduce((top, document) => ((document.sequenceNumber ?? 0) > (top.sequenceNumber ?? 0) ? document : top));
  return { series, last: highest.number, next: `${series}/${(highest.sequenceNumber ?? 0) + 1}` };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The detail: lines, VAT per rate, payment

/** The key of the words of a line type, or `null` for a type this client has no words for (shown as it came) and for a line the server did not give a type. */
export function lineTypeKey(lineType: string | null): string | null {
  return lineType !== null && (FISCAL_DOCUMENT_LINE_TYPES as readonly string[]).includes(lineType) ? `fiscalDocuments.detail.lineType.${lineType}` : null;
}

/** A rate of VAT as a percentage in the language of the person: `3,8%`. */
export function formatDocumentRate(percent: number, language: string): string {
  return `${numberFormat(language, null).format(percent)}%`;
}

/** One row of the VAT summary: the rate (and the nature code of an operation without VAT), what is taxed at it and the VAT of it. */
export interface VatRow {
  ratePercent: number;
  natureCode: string | null;
  taxable: number;
  vat: number;
}

/** An amount of the server in cents, as a whole number: the sums of the summary are made in cents, so that no figure picks up the error of a decimal. */
const centsOf = (amount: number): number => Math.round(amount * 100);

/**
 * The VAT per rate of a document, from its lines: what is taxed at each rate is the sum of the amounts of its lines (the server keeps them net of VAT), and the VAT of the rate is the sum of
 * the VAT the server stored on its lines when it sends it, else the taxable amount at the rate, to the cent. The summary is shown only when it **adds up to the totals of the document** (the
 * taxable base and the VAT the server wrote): a summary that does not is never drawn, whatever it would say: the totals and the PDF are the document.
 */
export function vatSummaryOf(detail: Pick<FiscalDocumentDetail, 'lines' | 'taxableBase' | 'vatAmount'>): VatRow[] | null {
  if (detail.lines.length === 0) return null;
  const groups = new Map<string, { ratePercent: number; natureCode: string | null; taxable: number; stored: number; allStored: boolean }>();
  for (const line of detail.lines) {
    const natureCode = line.vatRatePercent === 0 ? line.vatNatureCode : null;
    const key = `${line.vatRatePercent}|${natureCode ?? ''}`;
    const group = groups.get(key) ?? { ratePercent: line.vatRatePercent, natureCode, taxable: 0, stored: 0, allStored: true };
    group.taxable += centsOf(line.totalPrice);
    if (line.vatAmount === null) group.allStored = false;
    else group.stored += centsOf(line.vatAmount);
    groups.set(key, group);
  }
  const rows = [...groups.values()]
    .map((group) => ({
      ratePercent: group.ratePercent,
      natureCode: group.natureCode,
      taxable: group.taxable,
      vat: group.ratePercent === 0 ? 0 : group.allStored ? group.stored : Math.round((group.taxable * group.ratePercent) / 100),
    }))
    .sort((a, b) => b.ratePercent - a.ratePercent || (a.natureCode ?? '').localeCompare(b.natureCode ?? ''));
  const taxable = rows.reduce((sum, row) => sum + row.taxable, 0);
  const vat = rows.reduce((sum, row) => sum + row.vat, 0);
  if (taxable !== centsOf(detail.taxableBase) || vat !== centsOf(detail.vatAmount)) return null;
  return rows.map((row) => ({ ...row, taxable: row.taxable / 100, vat: row.vat / 100 }));
}

/** Whether a document has a line about the money at all: only an issued invoice or receipt does (a draft, a dropped draft, a credit note and a proforma have none). */
function hasCollectionLine(document: Pick<FiscalDocumentDetail, 'kind' | 'status'>): boolean {
  return document.status === 'Issued' && document.kind !== 'CreditNote' && document.kind !== 'Proforma';
}

/**
 * How a document stands on the money, in words, for the detail: «Pagato tramite il portale» when the portal collected it (the server says `Portal` as the channel), «Pagato», «Da incassare», and a state
 * nobody knows as it came. `null` when nothing is claimed: the server does not say, or the document has no collection (a draft, a credit note, a proforma).
 */
export function paymentWordsOf(document: Pick<FiscalDocumentDetail, 'kind' | 'status' | 'paymentState' | 'paymentChannel'>): DocumentState | null {
  if (!hasCollectionLine(document)) return null;
  switch (document.paymentState) {
    case 'Unknown':
      return null;
    case 'ToCollect':
      return { key: 'fiscalDocuments.detail.payment.toCollect', tone: 'warning', icon: 'clock' };
    case 'Paid':
      return { key: document.paymentChannel === 'Portal' ? 'fiscalDocuments.detail.payment.paidPortal' : 'fiscalDocuments.detail.payment.paid', tone: 'success', icon: 'check-circle' };
    default:
      return { key: 'fiscalDocuments.detail.payment.unrecognized', tone: 'neutral', icon: 'circle-dashed', detail: document.paymentState };
  }
}

/** One of the two parts of a payment that is split in two: how it stands, in words with a tone and an icon, and its amount as the server wrote it (in the currency of the document). */
export interface PaymentPart {
  state: DocumentState;
  amount: number;
}

/** The part of the payment that the portal collected, and the part (the tourist tax the portal left to the host) that is still to pay at the property. */
export interface PaymentSplit {
  /** `null` when nothing of the document was collected through the portal (it bills nothing but the tax): nothing is said of the portal then, as the PDF says nothing of it. */
  portal: PaymentPart | null;
  atProperty: PaymentPart;
}

const PORTAL_PART: DocumentState = { key: 'fiscalDocuments.detail.payment.paidPortal', tone: 'success', icon: 'check-circle' };
const PROPERTY_PART: DocumentState = { key: 'fiscalDocuments.detail.payment.toCollectAtProperty', tone: 'warning', icon: 'clock' };

/** The mark of the line of tourist tax that is paid at the property: «Da pagare in struttura», with a clock as the part of the payment has, so it is never told by color alone. */
export const LINE_AT_PROPERTY_STATE: DocumentState = { key: 'fiscalDocuments.detail.lines.toCollectAtProperty', tone: 'warning', icon: 'clock' };

/**
 * The payment of a document in the two parts the server says for the guest document of a portal that left the tourist tax to the host (FIX/FE-PORTAL-TAX-SPLIT): what the portal collected and the tourist tax still
 * to pay at the property, each with its words and its amount exactly as the server wrote it. Nothing is added, subtracted or rounded here, and nobody infers who collected what: the two parts do not always add up
 * to the total (a part of the tax that the collection of the stay records as collected is on neither), and the server, which knows, is the only one that says it. They replace the single state of
 * `paymentWordsOf` where that state would be drawn.
 *
 * `null` when the server says no such split (it leaves both amounts out of every other document: the document is then shown as it always was), and for a document that has no line about the money
 * (a draft, a dropped draft, a credit note, a proforma). The split is made by the part still to pay at the property: with nothing to pay there the document is not split. The portal part is left out
 * when it is not above zero: a document that bills nothing but the tax never says «paid through the portal» for nothing.
 */
export function paymentSplitOf(document: Pick<FiscalDocumentDetail, 'kind' | 'status' | 'amountPaidViaPortal' | 'amountToCollectAtProperty'>): PaymentSplit | null {
  if (!hasCollectionLine(document)) return null;
  const atProperty = document.amountToCollectAtProperty;
  if (atProperty === undefined || !(atProperty > 0)) return null;
  const portal = document.amountPaidViaPortal;
  return {
    portal: portal !== undefined && portal > 0 ? { state: PORTAL_PART, amount: portal } : null,
    atProperty: { state: PROPERTY_PART, amount: atProperty },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The card of the booking

/** The state of a document of the card of the booking: a draft, issued, a dropped draft; a state nobody knows is shown as it came and never as one that is complete. */
export function bookingDocumentStateOf(document: Pick<BookingFiscalDocument, 'status'>): DocumentState {
  switch (document.status) {
    case 'Draft':
      return state('draft', 'neutral', 'pencil');
    case 'Issued':
      return state('issued', 'success', 'check-circle');
    case 'Discarded':
      return state('discarded', 'neutral', 'ban');
    default:
      return state('unrecognizedStatus', 'neutral', 'circle-dashed', document.status);
  }
}

/** The collection line of a document of the card: only an issued invoice or receipt has one, and nothing is claimed when the server does not say. */
export function bookingDocumentPaymentOf(document: Pick<BookingFiscalDocument, 'kind' | 'status' | 'paymentState'>): DocumentState | null {
  return document.status !== 'Issued' || document.kind === 'CreditNote' || document.kind === 'Proforma' ? null : paymentStateOf(document);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Credit note

/** The longest reason of a credit note the server keeps (it cuts what is longer). */
export const CREDIT_REASON_MAX = 200;

export type CreditScope = 'whole' | 'part';

/** What the dialog of the credit note holds: the whole document or a part, the amount as typed and the reason. */
export interface CreditForm {
  scope: CreditScope;
  amount: string;
  reason: string;
}

export type CreditProblem = 'amountInvalid' | 'amountTooHigh' | 'reasonRequired';

/**
 * The amount a person typed: digits with at most two decimals, a point or a comma between them (`120`, `120,5`, `120.50`), above zero. A separator of thousands is not read (`1.250,00` is no
 * amount: whoever types it is asked for the figure without it), so that a figure is never read as another one.
 */
export function parseCreditAmount(text: string): number | null {
  const typed = text.trim().replace(/\s/g, '');
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(typed)) return null;
  const amount = Number(typed.replace(',', '.'));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/**
 * What is wrong with the credit note before it is asked of the server, or `null`: a part needs an amount above zero that is not above the total of the document (the server checks what is left
 * to credit: other credit notes may exist), and the reason is always asked. The comparison is in cents.
 */
export function creditProblemOf(form: CreditForm, total: number): CreditProblem | null {
  if (form.scope === 'part') {
    const amount = parseCreditAmount(form.amount);
    if (amount === null) return 'amountInvalid';
    if (centsOf(amount) > centsOf(total)) return 'amountTooHigh';
  }
  return form.reason.trim() === '' ? 'reasonRequired' : null;
}

/** The credit note as the server is asked for it: the whole document when the amount is left out. */
export function creditRequestOf(form: CreditForm): FiscalCreditNoteRequest {
  const reason = form.reason.trim().slice(0, CREDIT_REASON_MAX);
  const amount = form.scope === 'part' ? parseCreditAmount(form.amount) : null;
  return amount === null ? { reason } : { amount, reason };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Bulk issue

/** The most documents one bulk issue takes (the limit of the server). */
export const BATCH_MAX = 200;

/** A draft that gets a box: a draft CasaZen issues. */
export function isBatchDraft(document: Pick<FiscalDocumentEntry, 'source' | 'status'>): boolean {
  return document.source === 'CasaZen' && document.status === 'Draft';
}

/**
 * The drafts «Seleziona tutte le bozze del periodo» takes: the drafts of the stays. A credit note that is a draft is a correction the host looks at one by one, and is only ever issued in bulk
 * when its box is ticked by hand (the server does the same: a correction is issued only when it is named).
 */
export function isPeriodDraft(document: Pick<FiscalDocumentEntry, 'source' | 'status' | 'kind'>): boolean {
  return isBatchDraft(document) && document.kind !== 'CreditNote';
}

/** What the bulk issue came to, as the screen says it. */
export interface BatchOutcome {
  /** The documents that were asked for and answered. */
  asked: number;
  issued: number;
  failures: readonly { id: string; code: string | null }[];
  /** More drafts the selection matched than one request takes. */
  remaining: number;
  /** `all`: every document was issued and none is left; `some`: some were issued and not all; `none`: nothing was issued. */
  verdict: 'all' | 'some' | 'none';
}

/**
 * What the bulk issue came to. It is read from the rows, one per document: «all» is said only when every row was issued and nothing is left over, and one failed row (or one draft left) is
 * always a `some` or a `none`: the screen never says that everything was issued when one document was not.
 */
export function batchOutcomeOf(result: FiscalDocumentBatchResult): BatchOutcome {
  const failures = result.rows.filter((row) => !row.issued).map((row) => ({ id: row.id, code: row.errorCode }));
  const issued = result.rows.length - failures.length;
  const complete = result.rows.length > 0 && failures.length === 0 && result.remaining === 0;
  return { asked: result.rows.length, issued, failures, remaining: result.remaining, verdict: complete ? 'all' : issued > 0 ? 'some' : 'none' };
}

/** The reason one document of a bulk issue was not issued, in plain words: the words of its code when the app has them, else a sentence that says the reason is not known (never the code alone). */
export function batchReasonOf(code: string | null, t: TFunction): string {
  return translateErrorCode(code, t) ?? t('fiscalDocuments.batch.result.reasonUnknown');
}
