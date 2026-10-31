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

const enc = encodeURIComponent;

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
};
