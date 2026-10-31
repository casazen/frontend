import { ApiClient } from './client';

/**
 * The booking of a service from the public site of a supplier, by a customer with no account (backend SP-10, runbook `suppliers.md`
 * §23): the page **holds** a slot and e-mails a link, and only when the link is opened (and, for a booking paid inside CasaZen, the
 * card is blocked) the supplier receives a request. Everything here is anonymous (`public: true`); the answers carry no name, e-mail
 * or phone.
 */

/** What the booking sends to hold a slot (`POST /public/suppliers/{slug}/bookings`). */
export interface PublicBookingBody {
  /** Made up once for an attempt: the same id is the same booking (a retry after a lost answer takes no second slot). */
  clientRequestId: string;
  /** Slug of the published service. */
  service: string;
  /** The slot exactly as `GET …/slots` gave it. */
  startUtc: string;
  quantity?: number;
  surfaceSqm?: number;
  options?: { code: string; quantity: number }[];
  /** The slot is an urgent one (and the price carries the surcharge of the service, once). */
  urgent?: boolean;
  comuneIstat?: string;
  city: string;
  postalCode: string;
  address: string;
  floor?: string;
  accessNotes?: string;
  fullName: string;
  email: string;
  phone: string;
  /** The language of every e-mail to the customer. */
  locale: 'it' | 'en';
  privacyAccepted: boolean;
  /** The version of the notice the page showed (`privacyNoticeVersion` of the showcase). */
  privacyNoticeVersion: string;
  /** The trap for robots: never shown, always sent empty. */
  website: string;
}

/**
 * The block of the customer's card for a booking paid inside CasaZen (SP-15c-a): what the page needs to ask the card for it with the
 * Payment Element. Nothing is charged until the supplier accepts. Missing from the answer when the booking is not paid inside CasaZen.
 */
export interface PublicBookingCardBlock {
  /** The total that is blocked, in cents. */
  amountCents: number;
  currency: string;
  /** Null when the card is already blocked (`authorized`) or can no longer be asked for this block. */
  clientSecret?: string | null;
  publishableKey?: string | null;
  /** The card is already blocked: only the e-mail is left to check. */
  authorized: boolean;
}

/** The hold that waits for the e-mail check (201). */
export interface PublicBookingHold {
  id: string;
  /** When the hold lapses (UTC): the slot is free again and the link of the e-mail stops working. */
  expiresAt: string;
  payment?: PublicBookingCardBlock;
}

/**
 * The booking once the e-mail is checked (200), for the page the link opens. `status` is `Richiesto` the first time, the status by then
 * on a second click, and `AwaitingPayment` when the card is not blocked yet (then no request exists and `awaitingPayment` is true).
 */
export interface PublicBookingConfirmation {
  /** `XXXXX-XXXXX`: with the e-mail address, it finds the request again. */
  publicCode: string;
  status: string;
  serviceName: string;
  startUtc: string;
  endUtc: string;
  startLocal: string;
  endLocal: string;
  /** The instant the supplier has to answer by, while the request is new. */
  respondBy?: string | null;
  alreadyConfirmed: boolean;
  awaitingPayment?: boolean;
}

/** Who the customer says it is: the supplier's site, the code of the booking (`XXXXX-XXXXX`) and the e-mail it was made with. All in the body, never in the URL. */
export interface PublicBookingAccess {
  slug: string;
  code: string;
  email: string;
}

/** The status of the request of the booking, as the server names it. */
export type PublicBookingStatus = 'Richiesto' | 'PresoInCarico' | 'InCorso' | 'Completato' | 'Pagato' | 'Rifiutato' | 'Annullato';

interface PublicBookingPriceLine {
  kind: string;
  label: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
}

interface PublicBookingPrice {
  currency: string;
  estimatedAmountCents?: number | null;
  quotedAmountCents?: number | null;
  finalAmountCents?: number | null;
  /** The amount to show: the final total, else the supplier's quote, else the estimate; null is "to agree with the supplier". */
  amountCents?: number | null;
  /** Which of the three `amountCents` is. */
  basis?: 'final' | 'quote' | 'estimate' | null;
  lines: PublicBookingPriceLine[];
}

/** Another time the supplier proposed and the customer has not answered. */
interface PublicBookingProposal {
  startUtc: string;
  endUtc: string;
  startLocal: string;
  endLocal: string;
  proposedAt: string;
  /** The instant the customer has to answer by; after it the request is cancelled. */
  answerBy?: string | null;
  message?: string | null;
}

/** The quote the supplier sent and the customer has not answered (SP-04b). */
interface PublicBookingQuote {
  /** When the supplier sent it: the version of the quote, which the answer repeats. */
  sentAt: string;
  lines: { label: string; amountCents: number }[];
  totalCents: number;
  note?: string | null;
  /** Another time the quote offers instead of the booking's own. */
  startUtc?: string | null;
  endUtc?: string | null;
  startLocal?: string | null;
  endLocal?: string | null;
  answerBy?: string | null;
}

interface PublicBookingCancellation {
  at: string;
  by: 'customer' | 'supplier' | 'system';
  /** The text a person wrote; never a code. */
  reason?: string | null;
}

/** What the customer may do now: the page shows exactly these, and the endpoints enforce the same rules. */
export interface PublicBookingActions {
  canCancel: boolean;
  canReschedule: boolean;
  canRespondToProposal: boolean;
  canRespondToQuote: boolean;
  canConfirmOk: boolean;
  canReportProblem: boolean;
  canWithdrawProblem: boolean;
}

/** The customer's complaint about a job paid inside CasaZen, as the customer reads it (SP-15c-c). */
interface PublicBookingDispute {
  status: 'AwaitingSupplier' | 'AwaitingDecision' | 'ResolvedForSupplier' | 'ResolvedForCustomer' | 'Withdrawn';
  reason: string;
  noShow: boolean;
  openedByCasaZen: boolean;
  text?: string | null;
  openedAt: string;
  supplierReplyDueAt: string;
  supplierReplied: boolean;
  resolvedAt?: string | null;
  refundCents?: number | null;
  settled: boolean;
}

/** The money of a booking paid inside CasaZen (SP-15c-a); missing when the booking is not. */
interface PublicBookingPayment {
  status: 'authorized' | 'held' | 'released' | 'refunded' | 'canceled' | 'review';
  amountCents: number;
  currency: string;
  refundedCents: number;
  /** While CasaZen holds the money and the work is done: when it goes to the supplier if the customer says nothing. */
  releaseAtUtc?: string | null;
  releaseAtLocal?: string | null;
  dispute?: PublicBookingDispute | null;
}

/** The booking as it is now, after every call of the customer's own area (200). Times are UTC instants with the Rome clock next to them. */
export interface PublicBookingView {
  publicCode: string;
  status: PublicBookingStatus;
  service: { name: string; slug?: string | null };
  supplier: { name: string; slug: string };
  startUtc: string;
  endUtc: string;
  startLocal: string;
  endLocal: string;
  /** Where the work is: the comune always, the exact address only once the supplier took the request. */
  place: { city: string; postalCode?: string | null; address?: string | null; floor?: string | null; accessNotes?: string | null };
  price: PublicBookingPrice;
  /** When the supplier has to answer by, while the request is new and has no proposal or quote. */
  respondBy?: string | null;
  proposal?: PublicBookingProposal | null;
  quote?: PublicBookingQuote | null;
  cancellation?: PublicBookingCancellation | null;
  /** Why the supplier refused the request, when it said. */
  rejectionReason?: string | null;
  cancellationTerms: { freeUntilUtc: string; freeUntilLocal: string; isFree: boolean };
  actions: PublicBookingActions;
  /** `Custom` for a request on measure (SP-10b): no time, no price and a conversation. Missing for every other booking. */
  kind?: 'Custom';
  /** The conversation of a request on measure (SP-12c). */
  thread?: { canWrite: boolean; messages: { id: string; author: 'customer' | 'supplier' | 'system'; body: string; createdAt: string; readAt?: string | null }[] };
  negotiation?: string;
  payment?: PublicBookingPayment | null;
}

const enc = encodeURIComponent;

/** `POST api/public/supplier-bookings/<action>`: the credentials and what the action needs, all in the body. Answers the booking as it is after the call. */
const customerCall = (action: string, access: PublicBookingAccess, extra?: Record<string, unknown>) =>
  ApiClient.post<PublicBookingView>(`/public/supplier-bookings/${action}`, { ...access, ...extra }, { public: true });

export const publicBookingApi = {
  /**
   * Holds the slot and e-mails the link (30 minutes by default). 409 `supplier_slot_unavailable` (the slot went), 422
   * `supplier_booking_invalid` / `supplier_quote_invalid` (with `fields`) / `supplier_booking_outside_zone` /
   * `supplier_booking_consent_required|outdated` / `supplier_booking_offline`, 404 `supplier_service_not_found`, 429 `rate_limited`
   * (the three limits answer the same), 503 `payment_provider_error` (the block of the card could not be made).
   */
  createHold: (slug: string, body: PublicBookingBody) =>
    ApiClient.post<PublicBookingHold>(`/public/suppliers/${enc(slug)}/bookings`, body, { public: true }),

  /**
   * Checks the address with the token of the link (in the body, never in the URL of the API). 404 `supplier_booking_link_invalid` is
   * one answer for everything that does not open; 409 `supplier_booking_link_expired`; 422 `supplier_booking_supplier_unavailable`.
   */
  confirmEmail: (slug: string, holdId: string, token: string) =>
    ApiClient.post<PublicBookingConfirmation>(`/public/suppliers/${enc(slug)}/bookings/${enc(holdId)}/confirm-email`, { token }, { public: true }),

  /**
   * Finds the booking again with its code and e-mail. One 404 `supplier_booking_not_found` for a supplier, a code or an address that
   * does not match (nothing tells which); 429 with the wait (10 attempts per address and per IP).
   */
  lookup: (access: PublicBookingAccess) => customerCall('lookup', access),

  /** Cancels: a new request any time, a taken one until its time. Free (D6). 422 `supplier_booking_cannot_cancel`. */
  cancel: (access: PublicBookingAccess, reason?: string) => customerCall('cancel', access, reason ? { reason } : undefined),

  /** Moves a new request to another free time, exactly as `GET …/slots` gave it. 409 `supplier_slot_unavailable`; 422 `supplier_booking_cannot_reschedule`. */
  reschedule: (access: PublicBookingAccess, startUtc: string) => customerCall('reschedule', access, { startUtc }),

  /** Accepts the time the supplier proposed: the request is taken at that time. */
  acceptProposal: (access: PublicBookingAccess) => customerCall('proposal/accept', access),

  /** Turns the proposed time down: the request waits again at its own time. */
  rejectProposal: (access: PublicBookingAccess) => customerCall('proposal/reject', access),

  /** Accepts the quote it read (`quote.sentAt`, repeated as given): 409 `service_request_quote_changed` if the supplier replaced it meanwhile. */
  acceptQuote: (access: PublicBookingAccess, quoteSentAt: string) => customerCall('quote/accept', access, { quoteSentAt }),

  /** Turns the quote down. */
  rejectQuote: (access: PublicBookingAccess, quoteSentAt: string) => customerCall('quote/reject', access, { quoteSentAt }),
};
