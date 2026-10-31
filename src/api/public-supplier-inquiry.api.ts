import { ApiClient } from './client';

/**
 * The request on measure from the public site of a supplier, by a customer with no account (backend SP-10b, runbook `suppliers.md` §34):
 * the page keeps what the customer wrote, e-mails a link, and only when the link is opened a request exists for the supplier to answer in a
 * conversation inside CasaZen. Everything here is anonymous (`public: true`); the answers carry no name, e-mail, phone or word of the message.
 * The conversation, the offer and the rest are the customer's own area, in {@link publicBookingApi}.
 */

/** What the request on measure sends (`POST /public/suppliers/{slug}/inquiries`). */
export interface PublicInquiryBody {
  /** Made up once for an attempt: the same id is the same request (a retry after a lost answer sends no second e-mail). */
  clientRequestId: string;
  /** Slug of a published service the request is about, when it is about one (a service on quote too). */
  service?: string;
  comuneIstat?: string;
  /** The comune where the work is: the supplier covers some, and a request from outside them is refused. */
  city: string;
  /** What the customer needs, in its own words: 10 to 1000 characters. It is the first message of the conversation. */
  message: string;
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

/** The request that waits for the e-mail check (201). */
export interface PublicInquiryCreated {
  id: string;
  /** When the link lapses (UTC): after it the request has to be made again. */
  expiresAt: string;
}

/** The request once the e-mail is checked (200), for the page the link opens. A second click answers the same with `alreadyConfirmed`. */
export interface PublicInquiryConfirmation {
  /** `XXXXX-XXXXX`: with the e-mail address, it finds the request again. */
  publicCode: string;
  status: string;
  /** The service the request is about; missing when it is about none. */
  serviceName?: string | null;
  /** The instant the supplier has to answer by, while nobody answered; missing once it did. */
  respondBy?: string | null;
  alreadyConfirmed: boolean;
}

const enc = encodeURIComponent;

export const publicInquiryApi = {
  /**
   * Keeps what the customer wrote and e-mails the link (30 minutes by default); the supplier receives nothing before. 404 `not_found`
   * (the showcase) / `supplier_service_not_found`; 422 `supplier_booking_invalid` (with `fields`) / `supplier_booking_outside_zone` /
   * `supplier_booking_consent_required|outdated` / `supplier_booking_offline`; 429 `rate_limited` (the limits answer the same).
   */
  create: (slug: string, body: PublicInquiryBody) =>
    ApiClient.post<PublicInquiryCreated>(`/public/suppliers/${enc(slug)}/inquiries`, body, { public: true }),

  /**
   * Checks the address with the token of the link (in the body, never in the URL of the API). 404 `supplier_booking_link_invalid` is one
   * answer for everything that does not open; 409 `supplier_booking_link_expired`; 422 `supplier_booking_supplier_unavailable`.
   */
  confirmEmail: (slug: string, inquiryId: string, token: string) =>
    ApiClient.post<PublicInquiryConfirmation>(`/public/suppliers/${enc(slug)}/inquiries/${enc(inquiryId)}/confirm-email`, { token }, { public: true }),
};
