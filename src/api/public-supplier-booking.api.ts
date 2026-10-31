import { ApiClient } from './client';
import type { PublicSupplierPriceUnit } from './public-supplier.api';

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
  /** SP-10b-b: an offer of a request on measure waits, its time has not passed and the supplier is active. Missing from an older server: read as false. */
  canRespondToOffer?: boolean;
}

/** One message of the conversation of a request on measure: plain text, written by the customer, the supplier or CasaZen itself. */
export interface PublicBookingMessage {
  id: string;
  author: 'customer' | 'supplier' | 'system';
  body: string;
  createdAt: string;
  /** When the other party first read it; `null` marks what is new to the reader. */
  readAt?: string | null;
}

/** The conversation of a request on measure (SP-10b); `canWrite` is false once the request is closed or the supplier is not active. */
export interface PublicBookingThread {
  canWrite: boolean;
  messages: PublicBookingMessage[];
}

/** One line of an offer: how many of what, at the price of one. The amount is the server's. */
export interface PublicBookingOfferLine {
  label: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
}

/**
 * The offer the supplier sent for a request on measure and the customer has not answered (SP-10b-b). `sentAt` is its version, which the
 * answer repeats. The work is not reserved: the time is judged again when the customer accepts.
 */
export interface PublicBookingOffer {
  sentAt: string;
  lines: PublicBookingOfferLine[];
  totalCents: number;
  currency: string;
  note?: string | null;
  startUtc: string;
  endUtc: string;
  startLocal: string;
  endLocal: string;
  /** The instant the customer has to answer by; after it CasaZen closes the request. */
  validUntil?: string | null;
  /** Accepting is paid inside CasaZen: the card is blocked for the total and the request is taken when it is. */
  paymentRequired?: boolean;
}

/** What the browser needs to block the card for the offer it accepted: a credential, given only in the answer of the acceptance. */
export interface PublicBookingPaymentSession {
  clientSecret: string;
  publishableKey: string;
  amountCents: number;
  currency: string;
}

/** Another professional offered to the customer of a request nobody answered (SP-10c): what its showcase says, and the way to it. */
export interface PublicAlternative {
  name: string;
  slug: string;
  coverUrl?: string | null;
  coverAlt?: string | null;
  verified: boolean;
  /** The typical time to answer in minutes, measured; missing until it is. */
  medianResponseMinutes?: number | null;
  /** The service of the same category with the lowest "from" price; missing when it has none published. */
  service?: { slug: string; name: string; fromPriceCents?: number | null; priceUnit: PublicSupplierPriceUnit; requiresQuote: boolean } | null;
}

/**
 * Where the negotiation of a request on measure is. An open set: a state the page does not know is read as `InConversation`.
 */
export type PublicNegotiation = 'AwaitingSupplier' | 'InConversation' | 'OfferSent' | 'AwaitingPayment' | 'OfferDeclined' | 'Agreed' | 'Declined' | 'Expired' | 'Closed';

/** The customer's complaint about a job paid inside CasaZen, as the customer reads it (SP-15c-c). */
export interface PublicBookingDispute {
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
export interface PublicBookingPayment {
  /** `awaiting_card` (SP-10b-b): the offer was accepted and the card is not blocked yet. */
  status: 'awaiting_card' | 'authorized' | 'held' | 'released' | 'refunded' | 'canceled' | 'review';
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
  /** The conversation of a request on measure (SP-10b). */
  thread?: PublicBookingThread;
  /** Where the negotiation of a request on measure is (open set: see {@link PublicNegotiation}). */
  negotiation?: string;
  /** The offer that waits for the customer's answer (SP-10b-b); missing when there is none and for every other booking. */
  offer?: PublicBookingOffer | null;
  /** Only in the answer of an `offer/accept` that asks for a card: the credential for the Payment Element. Never kept anywhere but in the page. */
  paymentSession?: PublicBookingPaymentSession | null;
  payment?: PublicBookingPayment | null;
  /**
   * The other professionals offered to the customer of a request CasaZen closed because the supplier did not answer in time (SP-10c):
   * at most three, best first. An empty list is "nobody to suggest" and is said plainly; missing for every other booking.
   */
  alternatives?: PublicAlternative[];
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

  /**
   * "Tutto a posto" (SP-15c-a): the work is done and CasaZen holds the money; the supplier is paid at once. 422
   * `service_payment_not_confirmable` when there is nothing to release (not paid inside CasaZen, work not done, closed or stopped).
   */
  confirmOk: (access: PublicBookingAccess) => customerCall('confirm-ok', access),

  /**
   * "Segnala un problema" (SP-15c-c): stops the release until a person decides. `reason` is one of {@link COMPLAINT_REASONS}, `text`
   * at most 1000 characters (required for `other`). 422 `service_dispute_window_closed` / `_too_early` / `_not_reportable` / `_invalid`.
   */
  reportProblem: (access: PublicBookingAccess, reason: string, text: string) => customerCall('report-problem', access, { reason, text }),

  /** Takes the complaint back: the money is no longer stopped. 409 `service_dispute_not_open` if it was decided already. */
  withdrawProblem: (access: PublicBookingAccess) => customerCall('withdraw-problem', access),

  /**
   * A message of the customer in the conversation of a request on measure (SP-10b): 1 to 1000 characters of plain text. Answers the
   * request with the thread, the new message in it. 409 `service_request_thread_closed` / `service_request_state_changed`; 422
   * `service_request_message_invalid` / `service_request_thread_full` / `supplier_booking_supplier_unavailable`.
   */
  sendMessage: (access: PublicBookingAccess, body: string) => customerCall('messages', access, { body }),

  /**
   * Accepts the offer it read (`offer.sentAt`, repeated as given). Not paid inside CasaZen: the request is taken at the offer's time and
   * total. Paid inside CasaZen: the request is NOT taken yet, the answer is `negotiation: "AwaitingPayment"` with a `paymentSession` (the
   * same one if asked again before the card is blocked); asked again once the card is blocked it takes the request. 409
   * `service_request_offer_changed` (replaced or taken back), `supplier_slot_unavailable` / `supplier_commitment_conflict` (the time is
   * gone: nothing changed, the offer stands and nothing is charged), `payment_authorization_expired` / `payment_capture_failed` (nothing
   * charged), `service_payment_in_flight`; 422 `supplier_booking_no_offer` / `supplier_booking_offer_expired` /
   * `supplier_booking_supplier_unavailable`; 503 `payment_provider_error`.
   */
  acceptOffer: (access: PublicBookingAccess, offerSentAt: string) => customerCall('offer/accept', access, { offerSentAt }),

  /** Turns the offer down: the conversation goes on and nobody has a clock on them; a card block made for it is released. */
  declineOffer: (access: PublicBookingAccess, offerSentAt: string) => customerCall('offer/decline', access, { offerSentAt }),
};

/** The reasons of a complaint, as the server names them. `other` needs the words of the customer. */
export const COMPLAINT_REASONS = ['not_done', 'incomplete', 'poor_quality', 'not_as_described', 'other'] as const;
