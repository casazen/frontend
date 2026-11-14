/**
 * The invoices of the property manager to its owners (E14/F01/US01/T01, E13/F02/US01/T03, NF-114): the contract of `api/owner-invoices` of the backend (`OwnerInvoicesController`,
 * `agency.statement.view` to read, `agency.statement.manage` to write, behind the flag `OwnerInvoicing`).
 *
 * The words of the wire are stable codes, never a text to show: the screens translate them. The API writes the enums by name and the days as `yyyy-MM-dd`. Every amount is a number the
 * server wrote in `currency`: the client shows it as it comes and never converts it. A code this client does not know (the server may be newer) is shown as it came and never as a state
 * that is complete, which is why the state members are plain strings here.
 */

/** How an issued invoice is paid: `offset` (the statement covers it), `to_pay` (the owner owes `amountDue`) or `credited` (credit notes credited the whole invoice). */
export interface OwnerInvoiceSettlement {
  state: string;
  amountDue: number;
}

/** One invoice of the list (`GET api/owner-invoices`): drafts and issued ones, never the discarded ones nor the credit notes. A draft has no number and no payment. */
export interface OwnerInvoiceListItem {
  id: string;
  ownerId: string;
  ownerName: string | null;
  periodYear: number;
  periodMonth: number;
  statementVersionId: string | null;
  number: string | null;
  issueDate: string | null;
  /** `Draft` or `Issued`. */
  status: string;
  kind: string;
  taxableBase: number;
  vatAmount: number;
  stampDuty: number;
  total: number;
  currency: string;
  creditedInFull: boolean;
  payment: OwnerInvoiceSettlement | null;
}

/** A line of an invoice: its type (`Commission`, `Recharge`, `AdvancedExpense`), the net, the rate and the VAT of the line (`null` on a line written before it was stored). */
export interface OwnerInvoiceLine {
  lineNumber: number;
  type: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  vatRatePercent: number;
  vatNatureCode: string | null;
  vatAmount: number | null;
}

/**
 * An invoice with its lines, as `POST api/owner-invoices/drafts` and `…/{id}/issue` answer it. The recipient is named: its fiscal data are on the document and its PDF, never carried
 * here. `series` is the one of the owner invoices; a draft has no `number` (it is given at the issue, in sequence).
 */
export interface OwnerInvoice {
  id: string;
  ownerId: string | null;
  ownerName: string | null;
  statementVersionId: string | null;
  periodYear: number | null;
  periodMonth: number | null;
  kind: string;
  status: string;
  series: string | null;
  number: string | null;
  issueDate: string | null;
  currency: string;
  ruleVersion: string | null;
  taxableBase: number;
  vatAmount: number;
  stampDuty: number;
  total: number;
  hasXml: boolean;
  creditedInFull: boolean;
  lines: OwnerInvoiceLine[];
}

/** What narrows the list: a period (`yyyy-MM`) and an owner. Nothing is no limit. */
export interface OwnerInvoiceCriteria {
  period?: string;
  ownerId?: string;
}
