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

/** The parts of a statement, in the order of its PDF. */
export type OwnerPortalStatementSectionName = 'stays' | 'channelFees' | 'withholding' | 'commission' | 'recharges' | 'corrections' | 'payments';

/** The totals of a statement: `net` is the total of the period, `closingBalance` is what the agency owes the owner at the end of the month. */
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

/** A published statement as the list shows it: the period, the version, the currency of every amount and the totals. */
export interface OwnerPortalStatement {
  /** The version of the statement; the same id the conversations about a statement use. */
  statementId: string;
  agencyId: string;
  agencyName: string;
  year: number;
  month: number;
  version: number;
  currency: string;
  publishedAt: string;
  /** True when a later version of the period replaced it and that one is published too. */
  superseded: boolean;
  supersededByStatementId?: string | null;
  /** True when the PDF stored with it can be downloaded. */
  hasPdf: boolean;
  totals: OwnerPortalStatementTotals;
}

/** One line of a statement: no guest, never a name, an e-mail or a phone. */
export interface OwnerPortalStatementLine {
  id: string;
  type: string;
  /** The day the line counts for the owner. */
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  property?: string | null;
  channel?: string | null;
  bookingCode?: string | null;
  /** The kind of a flat fee: `cleaning` or `linen`. */
  kind?: string | null;
  /** The words of the agency for a charge, an expense or a correction. */
  description?: string | null;
  /** The part of the source the owner holds, in percent. */
  sharePercent: number;
  amount: number;
  /** True when the line reverses another. */
  reversal: boolean;
  /** True when the portal billed the agency, which recharges the commission to the owner. */
  channelFeeRechargedByAgency: boolean;
}

/** One part of a statement: its name, the sum of its lines and the lines, by day. */
export interface OwnerPortalStatementSection {
  section: OwnerPortalStatementSectionName;
  total: number;
  lines: OwnerPortalStatementLine[];
}

/** The tourist tax of one stay of the statement, collected by the agency: for information only, outside the net. */
export interface OwnerPortalTouristTax {
  property?: string | null;
  checkIn: string;
  checkOut: string;
  channel?: string | null;
  bookingCode?: string | null;
  /** The currency the tax was collected in. */
  currency: string;
  amount: number;
}

/** `GET api/owner-portal/statements/{id}`: a statement with its lines grouped as in its PDF, the invoice of the manager when one is linked, and the tourist tax box. */
export interface OwnerPortalStatementDetail {
  statement: OwnerPortalStatement;
  /** The name the agency keeps for the owner. */
  ownerName: string;
  ownerInvoiceNumber?: string | null;
  ownerInvoiceDate?: string | null;
  entriesSha256: string;
  sections: OwnerPortalStatementSection[];
  touristTax: OwnerPortalTouristTax[];
}

/** What kind of document an invoice of the manager is. */
export type OwnerPortalInvoiceKind = 'Invoice' | 'Receipt' | 'CreditNote';

/** `GET api/owner-portal/invoices`: an invoice of the property manager to the owner; the PDF is at `invoices/{id}/pdf`. */
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
  /** The version of the statement it was made from, when it is linked to one. */
  statementId?: string | null;
  /** True when credit notes credited the whole of it. */
  creditedInFull: boolean;
}
