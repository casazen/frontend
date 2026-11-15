/**
 * The wire files that pay the owners (backend `api/wire-transfers`, ADR-017, E16): a batch is built from the confirmed payouts of the owner accounting, one transfer
 * for each payout and one file per currency. The API writes the state by name and the days as `yyyy-MM-dd`; the instants are UTC ISO strings. Nothing here holds an
 * IBAN or the file: neither the list of the batches nor the payouts of the wire page have a member that could carry one.
 */

/** The currencies a wire file exists for: the Swiss file for the franc, the SEPA file for the euro. The reads of the payable payouts take one of them and no other. */
export type WireCurrency = 'CHF' | 'EUR';

/** Where a batch is: the file is made, the file was handed out, the administrator marked it as paid. */
export type WireBatchStatus = 'Generated' | 'Downloaded' | 'Paid';

/** A batch of `GET api/wire-transfers/batches` (the newest first): never an IBAN, a name or the file. */
export interface WireBatch {
  id: string;
  currency: string;
  status: WireBatchStatus;
  transferCount: number;
  /** The sum of the net amounts of its payouts, as the server wrote it. */
  totalAmount: number;
  /** The day the file asks the bank to execute the transfers; `null` for a batch made before the payouts. */
  executionDate: string | null;
  /** The message of the file (`pain.001.001.09.ch.03` for CHF); `null` for a batch made before the Swiss message. */
  format: string | null;
  createdAt: string;
  downloadedAt: string | null;
  paidAt: string | null;
}

/** `POST api/wire-transfers/batch`: the confirmed payouts to pay (one currency) and the day the bank is asked to execute them (`yyyy-MM-dd`). No account: the debit account is the issuer profile. */
export interface CreateBatchRequest {
  payoutIds: string[];
  executionDate: string;
}

/** What the server answers when it made the batch: as it computed it, never added up by the page. */
export interface CreateBatchResponse {
  batchId: string;
  currency: string;
  totalAmount: number;
  transferCount: number;
  executionDate?: string | null;
  format?: string | null;
}

/** Where a payout of the wire page is: `Confirmed` can be paid, `Reversed` is a payout reversed after its batch was made (it stays in the batch and says so). */
export type WirePayoutStatus = 'Confirmed' | 'Reversed';

/**
 * A payout on the wire page (`GET api/wire-transfers/payable-payouts?currency=` and `GET api/wire-transfers/batch/{id}/payouts`): who is paid (the owner by id and by the
 * name they are paid under), the period of the statement it pays, how much (`amount`: the net, the amount of the transfer) in which currency, when it was confirmed, where it is
 * and whether the owner has an IBAN now, **as a yes or a no**: the server never sends the IBAN, an address or the file, and the page keeps only these members.
 */
export interface WirePayout {
  payoutId: string;
  ownerId: string;
  /** The legal name of the owner, else the first and last name: the name the owner is paid under. */
  ownerName: string;
  periodYear: number;
  /** 1 to 12. */
  periodMonth: number;
  /** The net amount, the amount of the transfer, as the server wrote it. */
  amount: number;
  currency: string;
  confirmedAt: string;
  status: WirePayoutStatus;
  ownerHasIban: boolean;
}

/** `GET api/wire-transfers/batch/{id}/payouts`: the batch as the list of the batches shows it and the payouts it pays, in the order of the transfers of its file. */
export interface WireBatchPayouts {
  batch: WireBatch;
  /** Empty for a batch made before the payouts (from statements). */
  payouts: WirePayout[];
}
