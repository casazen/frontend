/**
 * The statements and the invoices of the property manager as the owner portal reads them (E13/F02/US02/T01): the contract of `GET api/owner-portal/statements`,
 * `statements/{id}` and `invoices`, written from the DTOs of the backend (E13/F01/US02/T02).
 *
 * Amounts are signed the way the owner ledger writes them: positive is owed to the owner, the commissions of the portals, the withholding, the commission of the manager and the
 * charges are negative. Every amount of a statement is in the `currency` of that statement; the tourist tax carries its own. The API writes the days as `yyyy-MM-dd` and the instants
 * as UTC ISO strings; a member without a value is `null` (or left out).
 *
 * NO type here carries a guest: a stay is told by its property, its days, its channel and its booking code. There is no member for a guest name, e-mail or phone, and none may
 * be added (ADR-011-R3, AC-NF111-1).
 */

export type OwnerPortalStatementSectionName = 'stays' | 'channelFees' | 'withholding' | 'commission' | 'recharges' | 'corrections' | 'payments';

export interface OwnerPortalStatementTotals {
  gross: number;
  channelFees: number;
  withholding: number;
  commission: number;
  charges: number;
  corrections: number;
  net: number;
  payments: number;
  openingBalance: number;
  closingBalance: number;
}

export interface OwnerPortalStatement {
  statementId: string;
  agencyId: string;
  agencyName: string;
  year: number;
  month: number;
  version: number;
  currency: string;
  publishedAt: string;
  superseded: boolean;
  supersededByStatementId?: string | null;
  hasPdf: boolean;
  totals: OwnerPortalStatementTotals;
}

export interface OwnerPortalStatementLine {
  id: string;
  type: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  property?: string | null;
  channel?: string | null;
  bookingCode?: string | null;
  kind?: string | null;
  description?: string | null;
  sharePercent: number;
  amount: number;
  reversal: boolean;
  channelFeeRechargedByAgency: boolean;
  channelFeeBilledToAgencyNotRecharged?: boolean;
  channelFeeChargedOnAgencyAccount?: boolean;
  informational?: boolean;
}

export interface OwnerPortalStatementSection {
  section: OwnerPortalStatementSectionName;
  total: number;
  lines: OwnerPortalStatementLine[];
}

export interface OwnerPortalTouristTax {
  property?: string | null;
  checkIn: string;
  checkOut: string;
  channel?: string | null;
  bookingCode?: string | null;
  currency: string;
  amount: number;
}

export interface OwnerPortalStatementDetail {
  statement: OwnerPortalStatement;
  ownerName: string;
  ownerInvoiceNumber?: string | null;
  ownerInvoiceDate?: string | null;
  entriesSha256: string;
  sections: OwnerPortalStatementSection[];
  touristTax: OwnerPortalTouristTax[];
}

export type OwnerPortalInvoiceKind = 'Invoice' | 'Receipt' | 'CreditNote';

export interface OwnerPortalInvoice {
  invoiceId: string;
  agencyId: string;
  agencyName: string;
  number: string;
  issueDate: string;
  kind: OwnerPortalInvoiceKind;
  total: number;
  currency: string;
  periodYear?: number | null;
  periodMonth?: number | null;
  statementId?: string | null;
  creditedInFull: boolean;
}

/**
 * `GET api/owner-portal/issued-documents` (E17/F02/US01/T01, E17/F03/US01/T03, NF-116): a document CasaZen issued in the name of the owner (the receipt of a private owner, the invoice of a company, their credit
 * notes): its number, its day, its kind, its total in its own currency and where it stands with the SDI. NOTHING of a guest is in it, not even its name: the PDF and the XML hold what the document says. The PDF is
 * at `issued-documents/{id}/pdf`, the XML (when `hasXml`) at `issued-documents/{id}/xml`.
 */
export interface OwnerPortalIssuedDocument {
  documentId: string;
  agencyId: string;
  agencyName: string;
  number: string;
  issueDate: string;
  kind: string;
  total: number;
  currency: string;
  /**
   * The state towards the SDI by the code the server writes (backend `FiscalDocumentSdiStatuses`): `not_applicable` (a receipt), `to_send`, `submitted`, `delivered`, `rejected` or `manual_declared`. The words
   * are written for these codes; any other one is shown as it came.
   */
  sdiStatus: string;
  hasXml: boolean;
}
