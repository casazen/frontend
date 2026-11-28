export type WireCurrency = 'CHF' | 'EUR';

export type WireBatchStatus = 'Generated' | 'Downloaded' | 'Paid';

export interface WireBatch {
  id: string;
  currency: string;
  status: WireBatchStatus;
  transferCount: number;
  totalAmount: number;
  executionDate: string | null;
  format: string | null;
  createdAt: string;
  downloadedAt: string | null;
  paidAt: string | null;
}

export interface CreateBatchRequest {
  payoutIds: string[];
  executionDate: string;
}

export interface CreateBatchResponse {
  batchId: string;
  currency: string;
  totalAmount: number;
  transferCount: number;
  executionDate?: string | null;
  format?: string | null;
}

type WirePayoutStatus = 'Confirmed' | 'Reversed';

/**
 * A payout on the wire page (`GET api/wire-transfers/payable-payouts?currency=` and `GET api/wire-transfers/batch/{id}/payouts`): who is paid (the owner by id and by the
 * name they are paid under), the period of the statement it pays, how much (`amount`: the net, the amount of the transfer) in which currency, when it was confirmed, where it is
 * and whether the owner has an IBAN now, **as a yes or a no**: the server never sends the IBAN, an address or the file, and the page keeps only these members.
 */
export interface WirePayout {
  payoutId: string;
  ownerId: string;
  ownerName: string;
  periodYear: number;
  periodMonth: number;
  amount: number;
  currency: string;
  confirmedAt: string;
  status: WirePayoutStatus;
  ownerHasIban: boolean;
}

export interface WireBatchPayouts {
  batch: WireBatch;
  payouts: WirePayout[];
}
