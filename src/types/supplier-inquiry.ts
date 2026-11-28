type SupplierMessageAuthor = 'Customer' | 'Supplier' | 'System' | (string & {});

export interface SupplierRequestMessage {
  id: string;
  author: SupplierMessageAuthor;
  /** Plain text of the customer or of the supplier. Personal data: shown to the two of them only, never logged. */
  body: string;
  createdAt: string;
  readAt?: string | null;
}

/**
 * Where the negotiation is (`negotiation` of the thread, derived by the server, never stored): `AwaitingSupplier` and `InConversation` (the
 * supplier has to answer), `OfferSent` (an offer waits for the customer), `OfferDeclined` (the customer turned it down, the conversation goes
 * on), `Agreed`, `Declined`, `Expired` and `Closed`. An open set: a state this version does not know is shown as `InConversation`.
 */
export type SupplierNegotiation =
  | 'AwaitingSupplier'
  | 'InConversation'
  | 'OfferSent'
  | 'OfferDeclined'
  | 'Agreed'
  | 'Declined'
  | 'Expired'
  | 'Closed'
  | (string & {});

interface SupplierOfferLine {
  label: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
}

export interface SupplierOffer {
  sentAt: string;
  lines: SupplierOfferLine[];
  totalCents: number;
  currency: string;
  note?: string | null;
  startUtc: string;
  endUtc: string;
  validUntil?: string | null;
}

export interface SupplierRequestThread {
  requestId: string;
  status: string;
  canWrite: boolean;
  respondBy?: string | null;
  messages: SupplierRequestMessage[];
  negotiation: SupplierNegotiation;
  offer?: SupplierOffer | null;
  canSendOffer: boolean;
}

export const INQUIRY_MESSAGE_MAX_LENGTH = 1000;

export interface SendSupplierOfferBody {
  lines: { label: string; quantity: number; unitAmountCents: number }[];
  startUtc: string;
  endUtc: string;
  note?: string;
}

export interface SupplierOfferResponse {
  requestId: string;
  status: string;
  negotiation: SupplierNegotiation;
  offer?: SupplierOffer | null;
}

type ServiceDisputeStatus = 'AwaitingSupplier' | 'AwaitingDecision' | 'ResolvedForSupplier' | 'ResolvedForCustomer' | 'Withdrawn' | (string & {});

type ServiceDisputeReason = 'not_done' | 'incomplete' | 'poor_quality' | 'not_as_described' | 'other' | (string & {});

/**
 * The complaint against the supplier about a job it did and is paid for through CasaZen (`GET /supplier/requests/{id}/dispute`, SP-15c-c): the
 * payer's words, the supplier's own reply, the state and the decision. Never the note of the admin who decided. `refundCents` is what went back
 * to the payer when it was decided for the customer, as the server gives it: nothing is worked out here.
 */
export interface SupplierServiceDispute {
  id: string;
  serviceRequestId: string;
  status: ServiceDisputeStatus;
  reason: ServiceDisputeReason;
  openedBy: string;
  noShow: boolean;
  customerText?: string | null;
  openedAt: string;
  replyDueAt: string;
  reply?: string | null;
  repliedAt?: string | null;
  canReply: boolean;
  resolvedAt?: string | null;
  refundCents?: number | null;
}

export const DISPUTE_REPLY_MAX_LENGTH = 1000;
