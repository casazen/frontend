/**
 * The fiscal documents of the host (FIS-03, FIS-04, NF-83, NF-84, NF-87, E06/F03/US04/T01): the contract of `GET api/fiscal/documents` of the backend
 * (`FiscalDocumentsController`, policy `payment.read`), the list of every document of the organization, the ones CasaZen issued for its direct bookings and the
 * ones imported read-only from the channel manager.
 *
 * The words of the wire are stable codes, never a text to show: the screens translate them. The API writes the enums by name, the SDI state in snake case, and
 * leaves out what is empty, so every member that may be missing is optional or `null` here. Every amount is a number the server wrote in `currency`: the client shows
 * it as it comes, never adds it up, rounds it to another unit or converts it.
 *
 * The API sends more than the page needs (the fiscal code, the VAT number, the address and the PEC of the recipient, the lines): the client keeps none of it. What
 * `GET api/fiscal/documents` brings is reduced to the members below when it is read, so that the personal and fiscal data of a recipient never reach the state of the
 * page, the cache of the queries or a log.
 */

/** The kinds of a stored document (backend `FiscalDocumentKind`): not the kind a regime asks for (`FiscalDocumentKind` of the issuer setting). */
export const FISCAL_DOCUMENT_ENTRY_KINDS = ['Invoice', 'CreditNote', 'Receipt', 'Proforma'] as const;
export type FiscalDocumentEntryKind = (typeof FISCAL_DOCUMENT_ENTRY_KINDS)[number];

/** Who issued a document: CasaZen, for a direct booking, or the channel manager (imported, read-only). */
export const FISCAL_DOCUMENT_SOURCES = ['CasaZen', 'Octorate'] as const;
export type FiscalDocumentSource = (typeof FISCAL_DOCUMENT_SOURCES)[number];

/** The life of a document: a draft has no number, an issued one is immutable, a discarded draft consumed no number. */
export const FISCAL_DOCUMENT_STATUSES = ['Draft', 'Issued', 'Discarded'] as const;
export type FiscalDocumentStatus = (typeof FISCAL_DOCUMENT_STATUSES)[number];

/** Whether the amount of a document was collected. `Unknown`: an imported document that says nothing. */
export const FISCAL_DOCUMENT_PAYMENT_STATES = ['Unknown', 'ToCollect', 'Paid'] as const;
export type FiscalDocumentPaymentState = (typeof FISCAL_DOCUMENT_PAYMENT_STATES)[number];

/** The states of a document on the SDI (the Italian exchange system of electronic invoices), as the server writes them. */
export const FISCAL_DOCUMENT_SDI_STATUSES = ['not_applicable', 'to_send', 'submitted', 'delivered', 'rejected', 'manual_declared', 'unknown'] as const;
export type FiscalDocumentSdiStatus = (typeof FISCAL_DOCUMENT_SDI_STATUSES)[number];

/**
 * One document of the list, reduced to what the page shows. `kind`, `source`, `status`, `paymentState` and `sdiStatus` are the codes above (a code this client does
 * not know, because the server is newer, is shown as it came and never as a state that is complete). `number` and `issueDate` (a Europe/Rome day, `YYYY-MM-DD`) are
 * the ones of the server: a draft has none. `hasXml` is whether CasaZen holds the FatturaPA XML; `octoratePdfAvailable` is whether the channel manager holds a PDF.
 */
export interface FiscalDocumentEntry {
  id: string;
  bookingId: string | null;
  source: string;
  kind: string;
  status: string;
  /** The series and the number in it that the server gave the document when it issued it (`number` is the two together): a draft has none. */
  series: string | null;
  sequenceNumber: number | null;
  number: string | null;
  issueDate: string | null;
  currency: string;
  recipientName: string | null;
  total: number;
  paymentState: string;
  sdiStatus: string;
  sdiErrorCode: string | null;
  hasXml: boolean;
  octoratePdfAvailable: boolean;
  /**
   * What the document is for (E17/F01/US01/T02): `GuestStay`, `OwnerInvoice` (the invoice of the property manager to an owner) or `SelfBilling` (a TD17). Only there when the server sends it; a purpose this client does
   * not know is shown as it came. An owner invoice and a self-billed invoice are never changed with the endpoints of the guest documents (the server refuses with 422), so the screens do not offer it.
   */
  purpose?: string;
  /** The rejected document that this draft replaces, when it is the replacement a correction made (it keeps the number of the rejected one): `null` or absent for any other document. */
  replacesDocumentId?: string | null;
  /** Who issued the document, by name, when the server says it (several documents of a booking may have several issuers: the owner, the agency): absent when it does not. */
  issuerName?: string | null;
}

/** One page of the list, newest first, as the server pages and counts it. */
export interface FiscalDocumentPage {
  items: FiscalDocumentEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/**
 * What narrows the list and the files (`from` and `to` are Europe/Rome days of the issue, both included). What is not set is not sent. The files (CSV, Excel) hold the
 * issued documents only and do not read `status`.
 */
export interface FiscalDocumentCriteria {
  from?: string;
  to?: string;
  kind?: string;
  source?: string;
  status?: string;
}

/** The two files of the list. */
export type FiscalDocumentExportFormat = 'csv' | 'xlsx';

/**
 * What the page needs to know of how the documents are issued, from `GET api/fiscal/documents/settings` and nothing more (no data of the issuer): who issues (`mode`,
 * `null` until the organization chooses), whether CasaZen may issue in this environment, and whether CasaZen has a channel to the SDI.
 */
export interface FiscalDocumentsContext {
  mode: string | null;
  casazenIssuanceEnabled: boolean;
  sdiProviderConfigured: boolean;
  /**
   * The pattern of the series of the documents of the guests, as the setting holds it (`{year}` stands for the year of the issue). `''`: the setting has none, so the server uses the
   * year. Left out (or `null`) when the setting could not say, and nothing is claimed about the series then.
   */
  guestDocumentSeries?: string | null;
}

/** A file the API sent back: its bytes and the name it gave it (`Content-Disposition`, when the page may read it). */
export interface FiscalDocumentFile {
  blob: Blob;
  contentDisposition: string | null;
}

/** What a line of a document is (backend `FiscalLineType`): the words are written for these codes, any other one is shown as it came. */
export const FISCAL_DOCUMENT_LINE_TYPES = ['Accommodation', 'AdvancedExpense', 'Cleaning', 'Commission', 'ExtraService', 'Other', 'Recharge', 'TouristTax'] as const;

/**
 * One line of a document as the detail shows it. The amounts are the ones the server stored: `totalPrice` is the amount of the line WITHOUT VAT (the server keeps the lines net of VAT) and
 * `unitPrice` the same per unit. `lineType` and `vatAmount` are there only when the server sends them (`null`: it did not, and nothing is made up).
 */
export interface FiscalDocumentLine {
  lineNumber: number;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  vatRatePercent: number;
  vatNatureCode: string | null;
  lineType: string | null;
  vatAmount: number | null;
  /**
   * `true` for the line of tourist tax that the portal left to the host and that nobody recorded as collected: the guest pays it at the property and the document does not declare it paid. Only there when the
   * server says it (it leaves the member out of every other line, and of every answer of an older server): the client never works out which line it is.
   */
  toCollectAtProperty?: boolean;
}

/** Who issued the document as it was when it was issued (the snapshot), as far as the server says it: `null` while the answer carries none. */
export interface FiscalDocumentIssuer {
  legalName: string | null;
  vatNumber: string | null;
  country: string | null;
}

/**
 * One document with its lines (`GET api/fiscal/documents/{id}`), reduced like the list: the name of the recipient is kept and nothing else of it (no fiscal code, VAT number, address or PEC).
 * `taxableBase`, `vatAmount`, `stampDuty` and `total` are the server's, in `currency`. `paymentChannel` (who collected the money: the portal, CasaZen or outside) and `issuer` are there only
 * when the server sends them.
 */
export interface FiscalDocumentDetail extends FiscalDocumentEntry {
  taxableBase: number;
  vatAmount: number;
  stampDuty: number;
  lines: FiscalDocumentLine[];
  paymentChannel: string | null;
  issuer: FiscalDocumentIssuer | null;
  /**
   * What the portal collected of the guest document of a booking whose portal left the tourist tax to the host, and the part of that tax still to pay at the property: both in `currency`, as the server wrote
   * them (FIX/BE-PORTAL-TAXLINE). They are there only when the server says the document is split that way, and both are left out of every other document and of every answer of an older server, which
   * then says what it said. The client never works them out, and never adds them to anything: they do not always add up to `total` (a part of the tax that the collection of the stay records as collected is
   * on neither), and `paymentState` stays the one the server stored.
   */
  amountPaidViaPortal?: number;
  amountToCollectAtProperty?: number;
}

/** What a write on a document answers, reduced to what the screens use: the document and the number it has now (a draft has none). */
export interface FiscalDocumentChange {
  id: string;
  number: string | null;
}

/** One document of a bulk issue: issued with its number, or not with the stable code of why (`errorCode`). */
export interface FiscalDocumentBatchRow {
  id: string;
  issued: boolean;
  number: string | null;
  errorCode: string | null;
}

/** The answer of a bulk issue: one row per document, how many were issued, how many were not, and how many more drafts the selection matched beyond what one request issues. */
export interface FiscalDocumentBatchResult {
  rows: FiscalDocumentBatchRow[];
  issued: number;
  failed: number;
  remaining: number;
}

/** What a credit note is asked for: the amount (the whole document when left out) and why. The confirmation is the host pressing the button. */
export interface FiscalCreditNoteRequest {
  amount?: number;
  reason: string;
}

/** One document of a booking as its card shows it (`GET api/bookings/{id}/fiscal-documents`): no recipient and no line. */
export interface BookingFiscalDocument {
  id: string;
  kind: string;
  status: string;
  number: string | null;
  total: number;
  currency: string;
  paymentState: string;
  issueDate: string | null;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The SDI: state, submission, declaration, correction (E17/F01/US02, E17/F03/US01/T02, NF-116, NF-86)

/**
 * Whose endpoints the SDI state of a document is read and changed through: the documents of the guests (and a self-billed invoice) are on `api/fiscal/documents/{id}/sdi` behind `payment.read` and
 * `payment.write`, an invoice of the property manager to an owner is on `api/owner-invoices/{id}/sdi` behind `agency.statement.view` and `agency.statement.manage` (the first answers 422
 * `document_owner_invoice` for an owner invoice).
 */
export type SdiScope = 'guest' | 'owner';

/**
 * Where an electronic invoice stands with the SDI, as the server says it (`GET .../sdi`): the state, the code of what went wrong and its reason in plain words (written in the language of the request, and
 * never naming the channel), when the state is of, and what can be done now. `submitted` is said only when the channel accepted the file, `delivered` and `rejected` only with an outcome, `manual_declared`
 * only with the declaration of a person: the client never works a state out of what it sent.
 */
export interface FiscalDocumentSdiState {
  documentId: string;
  status: string;
  errorCode: string | null;
  reason: string | null;
  statusUpdatedAt: string | null;
  /** A channel to the SDI is connected: «Invia» is attempted (otherwise it answers `NotConfigured`, and the XML is uploaded by hand). */
  providerConfigured: boolean;
  canSubmit: boolean;
  canDeclare: boolean;
  canCorrect: boolean;
}

/** The answer of «Invia»: what it did and the state of the document now. */
export interface SdiSubmitResult {
  /** What the submission did (backend `SdiSubmitOutcome`): `NotConfigured`, `Submitted`, `Refused` or `AlreadySubmitted`. `Submitted` is the only one that says the channel took the file; a code this client does not know is never read as a success. */
  outcome: string;
  state: FiscalDocumentSdiState;
}

/** What an issuer declares of a file it sent by hand: the day and the reference of the sending, or the code (and the text) of the notification of rejection the SDI sent. */
export type SdiDeclaration = { kind: 'Sent'; date: string; reference: string } | { kind: 'Rejected'; errorCode: string; errorText?: string };

/** One issuer with a VAT number that sends electronic invoices: the profile of the organization (`propertyOwnerId` is `null`) or the one of an owner who issues. */
export interface SdiIssuerRegistration {
  issuerProfileId: string;
  propertyOwnerId: string | null;
  /** Where the issuer stands with the channel (`GET api/fiscal/sdi/issuers`): its VAT number enabled (`registered`), not enabled yet (`pending`), or nothing submitted yet (`unknown`); any other code reads as `unknown`. */
  state: string;
}

/** The channel to the SDI of this environment and its issuers (`GET api/fiscal/sdi/issuers`). */
export interface SdiIssuers {
  providerConfigured: boolean;
  issuers: SdiIssuerRegistration[];
}
