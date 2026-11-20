/**
 * The self-billed invoices (TD17) of the commissions that foreign portals charge an Italian account holder (E17/F01/US03/T01, E17/F03/US01/T02, NF-116): the contract of `api/fiscal/self-billing` of the
 * backend (`SelfBillingController`, policy `agency.invoice.manage`, the whole organization only, behind the flag of the issuance of fiscal documents).
 *
 * The words of the wire are stable codes, never a text to show: the screens translate them. Every amount is a number the server wrote in `currency`: the client shows it as it comes, never adds it up,
 * rounds it to another unit or converts it. A TD17 keeps the foreign portal in the fields of the recipient of the document (it is the supplier of the service), so the screens read the holder and the
 * portal from here and never from the recipient of the document.
 */

/** One TD17 of the list: the holder, the foreign portal that charges the commission, the month, the day it is to be issued by, the amounts and the state towards the SDI. */
export interface SelfBillingListItem {
  id: string;
  /** Who holds the account of the portal and so is the issuer of the TD17 (backend `SelfBillingHolderKind`): `Agency` (V2) or `Owner` (V1, a company); any other code is shown as an unknown holder. */
  holderKind: string;
  holderOwnerId: string | null;
  holderName: string;
  portalName: string;
  portalCountry: string;
  periodYear: number;
  periodMonth: number;
  dueDate: string;
  number: string | null;
  issueDate: string | null;
  /** `Draft`, `Issued` or `Discarded` (backend `FiscalDocumentStatus`). */
  status: string;
  taxableBase: number;
  vatAmount: number;
  total: number;
  currency: string;
  sdiStatus: string;
  /**
   * «Correggi e rimanda» (`POST api/fiscal/self-billing/{id}/correct`) is offered: the TD17 is issued, rejected by the SDI, numbered and has no issued credit note (backend `SelfBillingRules.IsCorrectable`).
   * The server decides it; the client never works it out from the other members.
   */
  canCorrect: boolean;
  /** This draft (or the TD17 issued from it) replaces that rejected TD17 and holds its series and number; `null` on every other row. */
  replacesDocumentId: string | null;
  /** This TD17 is the rejected original that a correction discarded (`status` `Discarded`, `sdiStatus` `rejected`, its number kept): the draft that replaces it is that id. It is history, never an action. */
  replacedByDocumentId: string | null;
  /**
   * Why a draft that holds the number of a rejected TD17 is kept: `portal_not_configured`, `issuer_profile_incomplete`, `owner_issuer_missing` or `ledger_gives_no_td17` (a code this client does not know is shown as it
   * came). Such a draft can be neither issued nor discarded; `null` on every other row.
   */
  keptReason: string | null;
}

/** A line of a TD17: the commission of one property, its net, the rate and the VAT integrated on it. */
export interface SelfBillingLine {
  lineNumber: number;
  description: string;
  totalPrice: number;
  vatRatePercent: number;
  vatAmount: number | null;
}

/**
 * A TD17 with its lines, for the review before the issue: the version of the settings it was made with, the rate of the VAT integrated, whether the XML exists and, for a draft, the part of its taxable
 * amount that is an estimate (`estimatedAmount`: a rule of the agency or the default of the channel, not the figure of the portal): the issue asks to accept it.
 */
export interface SelfBillingDetail {
  invoice: SelfBillingListItem;
  ruleVersion: string | null;
  vatRatePercent: number | null;
  hasXml: boolean;
  estimatedAmount: number;
  lines: SelfBillingLine[];
}

/** One TD17 of a generation: `result` is `created`, `updated` or `already_issued`. */
export interface SelfBillingOutcome {
  documentId: string;
  holderKind: string;
  holderOwnerId: string | null;
  portalName: string;
  result: string;
  taxableBase: number;
  estimatedAmount: number;
  changedSinceIssue: boolean;
}

/** A holder that needs a TD17 and cannot get one: the code of the reason and the fields its issuer profile misses. */
export interface SelfBillingFailure {
  holderKind: string;
  holderOwnerId: string | null;
  portalName: string;
  code: string;
  fields: string[];
}

/** Commissions of the month that are not self-billed: the reason, the channel, the number of stays and their commission. */
export interface SelfBillingNotDue {
  reason: string;
  channel: string;
  stays: number;
  amount: number;
  currency: string;
}

/**
 * A draft that holds the number of a rejected TD17 and that nothing gives now: the drafts of the month keep it, never drop it, and say why (`reason`, the codes of `SelfBillingListItem.keptReason`). It can be neither issued
 * nor discarded: what its number is for is the accountant's decision.
 */
export interface SelfBillingKept {
  documentId: string;
  holderKind: string;
  holderOwnerId: string | null;
  portalName: string;
  number: string | null;
  reason: string;
}

/**
 * What the drafts of a month did: how many were made, made again, left alone because they were issued already and dropped because the ledger no longer supports them, one row for each TD17, the holders
 * that need one and cannot get one yet, the commissions that are not self-billed with the reason, the drafts that hold the number of a rejected TD17 and are kept (`kept`), and whether the owner ledger of the month is
 * posted (`ledgerPosted` false: the drafts read the ledger, so the month has to be posted by the owner accounting first).
 */
export interface SelfBillingGeneration {
  year: number;
  month: number;
  created: number;
  updated: number;
  alreadyIssued: number;
  discarded: number;
  drafts: SelfBillingOutcome[];
  failed: SelfBillingFailure[];
  notDue: SelfBillingNotDue[];
  kept: SelfBillingKept[];
  ledgerPosted: boolean;
}

/** `POST api/fiscal/self-billing/{id}/issue`: the confirmation, and the acceptance of the estimated part of the amount when there is one (without it the server refuses and numbers nothing). */
export interface SelfBillingIssueRequest {
  acceptEstimate: boolean;
}
