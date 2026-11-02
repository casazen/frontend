// The requests "su misura" of the public showcase as the supplier answers them (SP-10b, SP-10b-b) and the complaint about a job paid through
// CasaZen (SP-15c-c): the conversation with the customer, the offer, the dispute. All of it is the server's word; nothing here is worked out.

/**
 * `kind` of a request of the supplier: `Standard` (a host's request, or a booking at a free slot) or `Custom` (a request on measure from the
 * showcase: no time and no price until the supplier's offer is accepted). An open set: a kind this version does not know is a standard one.
 */
export type SupplierRequestKind = 'Standard' | 'Custom' | (string & {});

/** Who wrote a message of the conversation: the customer, the supplier or CasaZen itself. */
export type SupplierMessageAuthor = 'Customer' | 'Supplier' | 'System' | (string & {});

export interface SupplierRequestMessage {
  id: string;
  author: SupplierMessageAuthor;
  /** Plain text of the customer or of the supplier. Personal data: shown to the two of them only, never logged. */
  body: string;
  createdAt: string;
  /** When the other party first read it; empty while it did not. */
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

/** One line of an offer: what it is for, how many and the price of one, in cents of euro (gross, as declared); `amountCents` is their product. */
export interface SupplierOfferLine {
  label: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
}

/**
 * The offer that waits for the customer's answer (SP-10b-b). It is the quote of SP-04b (one engine): `sentAt` is its version, `totalCents` what
 * the lines add up to, `validUntil` the instant the customer has to answer by. The time is not held: the planner judges it again when the
 * customer accepts.
 */
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

/** `GET /supplier/requests/{id}/thread`: the conversation, whether the supplier may write and send an offer, the time left to answer. */
export interface SupplierRequestThread {
  requestId: string;
  status: string;
  /** The request is open and the supplier is active: a message can be added. */
  canWrite: boolean;
  /** The instant the supplier has to answer by, while nobody answered; empty after its first message and while an offer waits. */
  respondBy?: string | null;
  /** In the order they were written; at most 200. */
  messages: SupplierRequestMessage[];
  negotiation: SupplierNegotiation;
  offer?: SupplierOffer | null;
  /** The request is new and the supplier is active: `POST offer` is possible (a new one replaces the one that waits). */
  canSendOffer: boolean;
}

/** Limits of the conversation (`ShowcaseInquiryLimits`): the server checks them again and its answer wins. */
export const INQUIRY_MESSAGE_MAX_LENGTH = 1000;

/** `POST /supplier/requests/{id}/offer` (SP-10b-b): one to twenty lines, the time (UTC instants, whole minutes) and a note. */
export interface SendSupplierOfferBody {
  lines: { label: string; quantity: number; unitAmountCents: number }[];
  startUtc: string;
  /** A request on measure names no service to take the duration from: the end is always sent. */
  endUtc: string;
  note?: string;
}

/** The answer of `POST …/offer` and `…/offer/withdraw`: the request as it is now. */
export interface SupplierOfferResponse {
  requestId: string;
  status: string;
  negotiation: SupplierNegotiation;
  offer?: SupplierOffer | null;
}

/** The states of a complaint (`ServiceDisputeStatus`): an open set, a state this version does not know is shown as waiting for the decision. */
export type ServiceDisputeStatus = 'AwaitingSupplier' | 'AwaitingDecision' | 'ResolvedForSupplier' | 'ResolvedForCustomer' | 'Withdrawn' | (string & {});

/** Why the payer complained, in the server's words; an open set. */
export type ServiceDisputeReason = 'not_done' | 'incomplete' | 'poor_quality' | 'not_as_described' | 'other' | (string & {});

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
  /** `customer`, `host` or `system` (CasaZen opened it for a job nobody marked completed). */
  openedBy: string;
  /** The supplier never marked the work completed and the time agreed for it ended. */
  noShow: boolean;
  customerText?: string | null;
  openedAt: string;
  /** When the supplier's time to reply ends; a later reply is still taken while the dispute is open. */
  replyDueAt: string;
  reply?: string | null;
  repliedAt?: string | null;
  /** The supplier can still reply: the dispute is open and it has not replied. */
  canReply: boolean;
  resolvedAt?: string | null;
  refundCents?: number | null;
}

/** Longest reply to a complaint (`ServiceDisputeLimits.TextMaxLength`). */
export const DISPUTE_REPLY_MAX_LENGTH = 1000;
