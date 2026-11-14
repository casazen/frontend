/**
 * The wire files that pay the owners (backend `api/wire-transfers`, ADR-017, E16): a batch is built from the confirmed payouts of the owner accounting, one transfer
 * for each payout and one file per currency. The API writes the state by name and the days as `yyyy-MM-dd`; the instants are UTC ISO strings. Nothing here holds an
 * IBAN or the file: the list of the batches has no member that could carry one.
 */

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

/**
 * An owner of the registry as the wire page keeps it: the name and the end of the bank account (`•••• 3456`), nothing else. The registry answer holds the e-mail and the
 * phone of the owner too; the page does not keep them.
 */
export interface WireOwner {
  id: string;
  name: string;
  /** The end of the IBAN, already masked; `null` when the owner has no IBAN. */
  ibanEnd: string | null;
}
