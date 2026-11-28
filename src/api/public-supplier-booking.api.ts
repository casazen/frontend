import { ApiClient } from './client';
import type { PublicSupplierPriceUnit } from './public-supplier.api';

export interface PublicBookingBody {
  /** Made up once for an attempt: the same id is the same booking (a retry after a lost answer takes no second slot). */
  clientRequestId: string;
  service: string;
  startUtc: string;
  quantity?: number;
  surfaceSqm?: number;
  options?: { code: string; quantity: number }[];
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
  locale: 'it' | 'en';
  privacyAccepted: boolean;
  privacyNoticeVersion: string;
  website: string;
}

export interface PublicBookingCardBlock {
  amountCents: number;
  currency: string;
  clientSecret?: string | null;
  publishableKey?: string | null;
  authorized: boolean;
}

export interface PublicBookingHold {
  id: string;
  expiresAt: string;
  payment?: PublicBookingCardBlock;
}

export interface PublicBookingConfirmation {
  publicCode: string;
  status: string;
  serviceName: string;
  startUtc: string;
  endUtc: string;
  startLocal: string;
  endLocal: string;
  respondBy?: string | null;
  alreadyConfirmed: boolean;
  awaitingPayment?: boolean;
}

export interface PublicBookingAccess {
  slug: string;
  code: string;
  email: string;
}

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
  amountCents?: number | null;
  basis?: 'final' | 'quote' | 'estimate' | null;
  lines: PublicBookingPriceLine[];
}

interface PublicBookingProposal {
  startUtc: string;
  endUtc: string;
  startLocal: string;
  endLocal: string;
  proposedAt: string;
  answerBy?: string | null;
  message?: string | null;
}

interface PublicBookingQuote {
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
  reason?: string | null;
}

export interface PublicBookingActions {
  canCancel: boolean;
  canReschedule: boolean;
  canRespondToProposal: boolean;
  canRespondToQuote: boolean;
  canConfirmOk: boolean;
  canReportProblem: boolean;
  canWithdrawProblem: boolean;
  canRespondToOffer?: boolean;
}

export interface PublicBookingMessage {
  id: string;
  author: 'customer' | 'supplier' | 'system';
  body: string;
  createdAt: string;
  readAt?: string | null;
}

export interface PublicBookingThread {
  canWrite: boolean;
  messages: PublicBookingMessage[];
}

export interface PublicBookingOfferLine {
  label: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
}

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
  validUntil?: string | null;
  paymentRequired?: boolean;
}

export interface PublicBookingPaymentSession {
  clientSecret: string;
  publishableKey: string;
  amountCents: number;
  currency: string;
}

export interface PublicAlternative {
  name: string;
  slug: string;
  coverUrl?: string | null;
  coverAlt?: string | null;
  verified: boolean;
  medianResponseMinutes?: number | null;
  service?: { slug: string; name: string; fromPriceCents?: number | null; priceUnit: PublicSupplierPriceUnit; requiresQuote: boolean } | null;
}

export type PublicNegotiation = 'AwaitingSupplier' | 'InConversation' | 'OfferSent' | 'AwaitingPayment' | 'OfferDeclined' | 'Agreed' | 'Declined' | 'Expired' | 'Closed';

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

export interface PublicBookingPayment {
  status: 'awaiting_card' | 'authorized' | 'held' | 'released' | 'refunded' | 'canceled' | 'review';
  amountCents: number;
  currency: string;
  refundedCents: number;
  releaseAtUtc?: string | null;
  releaseAtLocal?: string | null;
  dispute?: PublicBookingDispute | null;
}

export interface PublicBookingView {
  publicCode: string;
  status: PublicBookingStatus;
  service: { name: string; slug?: string | null };
  supplier: { name: string; slug: string };
  startUtc: string;
  endUtc: string;
  startLocal: string;
  endLocal: string;
  place: { city: string; postalCode?: string | null; address?: string | null; floor?: string | null; accessNotes?: string | null };
  price: PublicBookingPrice;
  respondBy?: string | null;
  proposal?: PublicBookingProposal | null;
  quote?: PublicBookingQuote | null;
  cancellation?: PublicBookingCancellation | null;
  rejectionReason?: string | null;
  cancellationTerms: { freeUntilUtc: string; freeUntilLocal: string; isFree: boolean };
  actions: PublicBookingActions;
  kind?: 'Custom';
  thread?: PublicBookingThread;
  negotiation?: string;
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

const customerCall = (action: string, access: PublicBookingAccess, extra?: Record<string, unknown>) =>
  ApiClient.post<PublicBookingView>(`/public/supplier-bookings/${action}`, { ...access, ...extra }, { public: true });

export const publicBookingApi = {
  createHold: (slug: string, body: PublicBookingBody) =>
    ApiClient.post<PublicBookingHold>(`/public/suppliers/${enc(slug)}/bookings`, body, { public: true }),

  confirmEmail: (slug: string, holdId: string, token: string) =>
    ApiClient.post<PublicBookingConfirmation>(`/public/suppliers/${enc(slug)}/bookings/${enc(holdId)}/confirm-email`, { token }, { public: true }),

  lookup: (access: PublicBookingAccess) => customerCall('lookup', access),

  cancel: (access: PublicBookingAccess, reason?: string) => customerCall('cancel', access, reason ? { reason } : undefined),

  reschedule: (access: PublicBookingAccess, startUtc: string) => customerCall('reschedule', access, { startUtc }),

  acceptProposal: (access: PublicBookingAccess) => customerCall('proposal/accept', access),

  rejectProposal: (access: PublicBookingAccess) => customerCall('proposal/reject', access),

  acceptQuote: (access: PublicBookingAccess, quoteSentAt: string) => customerCall('quote/accept', access, { quoteSentAt }),

  rejectQuote: (access: PublicBookingAccess, quoteSentAt: string) => customerCall('quote/reject', access, { quoteSentAt }),

  confirmOk: (access: PublicBookingAccess) => customerCall('confirm-ok', access),

  reportProblem: (access: PublicBookingAccess, reason: string, text: string) => customerCall('report-problem', access, { reason, text }),

  withdrawProblem: (access: PublicBookingAccess) => customerCall('withdraw-problem', access),

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

  declineOffer: (access: PublicBookingAccess, offerSentAt: string) => customerCall('offer/decline', access, { offerSentAt }),
};

export const COMPLAINT_REASONS = ['not_done', 'incomplete', 'poor_quality', 'not_as_described', 'other'] as const;
