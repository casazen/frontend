/**
 * The withholding of a month (`GET api/withholding/summary`): the evidence of the payouts paid in the month and of their reversals that the rule applied to,
 * summed by the server per owner. Every figure is the server's and is in euro: the withholding is declared in euro, so the answer has no currency field.
 * The F24 of the month is the `TaxF24Record` of the owner accounting.
 */
export interface WithholdingSummary {
  month: number;
  year: number;
  totalBase: number;
  totalWithholding: number;
  ownerSummaries: WithholdingOwnerSummary[];
}

/** The withholding of one owner in the month. */
export interface WithholdingOwnerSummary {
  ownerId: string;
  ownerName: string;
  totalBase: number;
  totalWithholding: number;
  /** The payouts the withholding comes from (a reversal is not one). */
  payoutCount: number;
}

/**
 * Registers that an F24 was paid (`POST api/withholding/reconcile`): the F24 by its id, and the day it was paid. It records the payment, not the filing,
 * and it is the administrator's word: nothing here knows whether the bank or the Revenue Agency has it.
 */
export interface RecordPaymentRequest {
  f24Id: string;
  paidAt: string; // ISO instant
}
