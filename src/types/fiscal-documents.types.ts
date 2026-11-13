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
}

/** A file the API sent back: its bytes and the name it gave it (`Content-Disposition`, when the page may read it). */
export interface FiscalDocumentFile {
  blob: Blob;
  contentDisposition: string | null;
}
