import type { TouristTaxQuoteStatus } from './tourist-tax.types';

export interface DirectBookingGuestPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  country: string;
}

export interface DirectBookingConsentPayload {
  dataProcessing: boolean;
  consentVersion: string;
}

export type PaymentOption = 'Immediate' | 'OnCancellationDeadline' | 'OnSite';

/**
 * Where the guest of a checkout came from (`attribution` of `POST /api/public/bookings`, E27/F01/US01/T01, NF-123): the `utm_*` of the link they followed and the
 * host name of the site they came from (`referrer`, written with two r like the API: a name on the internet with a dot in it, never an IP address or a machine of a private
 * network, and only with such a link or with the consent to statistics). Every field is optional, and only what is a lower-case token (or a host name) is sent: the API drops
 * the rest without refusing the booking, and keeps nothing that is the guest's. No address of a page, no e-mail, no phone number.
 */
export interface DirectBookingAttributionPayload {
  source?: string;
  medium?: string;
  campaign?: string;
  referrer?: string;
}

export interface CheckoutExtraSelection {
  id: string;
  quantity: number;
  expectedUnitPrice: number;
}
export interface CheckoutExtraOffer {
  id: string;
  name: string;
  description: string;
  unitPrice: number;
  byQuantity: boolean;
  requiresApproval: boolean;
}

export interface CreateDirectBookingPayload {
  extras?: CheckoutExtraSelection[];
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfAdults: number;
  numberOfChildren: number;
  guest: DirectBookingGuestPayload;
  consent: DirectBookingConsentPayload;
  specialRequests?: string;
  paymentOption?: PaymentOption;
  /** Age of each minor at check-in (0-17), sent when the tourist tax depends on it (BK-03). */
  childrenAges?: number[];
  /** When the guest thinks they will arrive: `HH:mm` or `late`. Only a note for the host (DB-03b); left out when they do not say. */
  expectedArrivalTime?: string;
  /**
   * The guest ticked the optional «E-mail» box for offers (NF-90). Sent (`false` when left unticked) only when the site has a version of the
   * consent text (`marketingConsentVersion`); the old single `marketingConsent` is no longer sent.
   */
  marketingConsentEmail?: boolean;
  /** The guest ticked the optional «WhatsApp» box for offers; same rule as `marketingConsentEmail`, and it needs the phone number of the guest (422 without). */
  marketingConsentWhatsApp?: boolean;
  /**
   * The version of the soft opt-in notice the page showed (the `softOptInNoticeVersion` of the public org): sent only when the site has one.
   * It is a notice, not a consent: the guest ticks nothing for it.
   */
  softOptInNoticeVersion?: string;
  /**
   * Where the guest came from (E27/F01/US01/T01, NF-123): the source of the link of the address and the host of the site they came from, left out when there is none.
   * With the source of the booking it tells the host the origin («Sito dell'agenzia» for a link the agency copied). It changes no price and no availability.
   */
  attribution?: DirectBookingAttributionPayload;
}

/** Body of `POST /public/bookings/quote`: the stay to price before booking. */
export interface DirectBookingQuotePayload {
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfAdults: number;
  numberOfChildren: number;
  childrenAges?: number[];
}

export interface TouristTaxQuote {
  status: TouristTaxQuoteStatus;
  /** Only when `status` is `Calculated`. */
  amount: number | null;
  taxableNights: number;
  /** True when the amount depends on the age of the minors: the checkout asks it. */
  ageRulesApply: boolean;
  categories: string[];
}

/**
 * What the checkout may offer and promise for a stay, decided by the backend (BK-07, A3-16): the page never offers an
 * option the API refuses, nor a free cancellation the guest cannot use.
 */
export interface DirectBookingPaymentOptions {
  /** "Paga alla scadenza" can be chosen: its charge day is after today in Europe/Rome. */
  deferredPaymentAvailable: boolean;
  /** Day (`YYYY-MM-DD`) the saved card is charged; null when the deferred payment is not available. */
  deferredChargeDate: string | null;
  /**
   * Last day (`YYYY-MM-DD`) the guest can cancel for free by themselves, from the guest area or with the link of the host (DB-08a);
   * null when the cancellation policy of the property does not refund in full for this stay. "Cancellazione gratuita fino a…" is
   * shown only when set.
   */
  freeCancellationUntil: string | null;
}

/** What a line of the price breakdown of a quote is (DB-03). `Discount` is not sent yet; a page that meets a kind it does not know shows it plainly. */
export type QuoteLineKind = 'Nights' | 'WeekendNights' | 'CleaningFee' | 'TouristTax' | 'Total' | 'Discount';

/**
 * One line of the price breakdown of a quote (DB-03), in cents of the currency of the quote, whole numbers. The lines before the
 * total add up to it, to the cent: a page shows them as they come and adds nothing of its own.
 */
export interface QuoteLine {
  kind: QuoteLineKind;
  /** Nights of a night line, 1 for the cleaning fee; null for the tourist tax and the total. */
  quantity: number | null;
  /** Price of one night (night lines) or the fee; null for the tourist tax and the total. */
  unitAmountCents: number | null;
  amountCents: number;
}

/**
 * What cancelling costs for this stay, in dates (DB-03b): the last whole days (`YYYY-MM-DD`, Europe/Rome, included) with the full
 * and the partial refund. A window the policy does not have, or that is already over, is null. A page shows the dates only when
 * `selfServiceAvailable` is true: the guest can then cancel by themselves and the system keeps the promise.
 */
export interface StayCancellation {
  fullRefundUntil: string | null;
  partialRefundPercent: number | null;
  partialRefundUntil: string | null;
  selfServiceAvailable: boolean;
}

/** Price computed by the backend: the same numbers the booking records and charges. */
export interface DirectBookingQuote {
  extraOffers?: CheckoutExtraOffer[];
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  nightlyRate: number;
  lodgingTotal: number;
  cleaningFee: number;
  basePrice: number;
  touristTax: TouristTaxQuote;
  /** Base price + tourist tax when calculated. */
  totalPrice: number;
  currency: string;
  paymentOptions: DirectBookingPaymentOptions;
  /** The price breakdown in cents, in order, ending with the total (DB-03); absent from an older backend. */
  lines?: QuoteLine[];
  /** The dates of the cancellation policy for this stay (DB-03b); absent from an older backend or when the property has no policy. */
  cancellation?: StayCancellation | null;
}

export interface ConnectedAccountPublishableContext {
  publishableKey: string;
  stripeAccountId: string;
}

export interface DirectBookingResponse {
  bookingId: string;
  clientSecret: string;
  setupIntentClientSecret?: string;
  connectedAccountPublishableContext: ConnectedAccountPublishableContext;
  amount: number;
  currency: string;
  touristTaxAmount: number;
  basePrice: number;
  freeRefundDeadline: string;
  paymentOption: PaymentOption;
  /** Whether `touristTaxAmount` was calculated; otherwise the tax is not included in `amount`. */
  touristTaxStatus?: TouristTaxQuoteStatus;
  /**
   * "Pay at the property" only (BK-06): the booking is a request, not confirmed. The guest must confirm the email
   * (link sent by email) by this instant; then the host accepts or declines.
   */
  emailConfirmationExpiresAt?: string | null;
  /**
   * Token of the outcome page `/book/{orgSlug}/booking/{bookingId}?token=…` (BK-07): the only way to read the real state
   * of this booking and to pay the same hold again. Given only here.
   */
  checkoutToken: string;
}

/** Answer of `POST /api/public/bookings/{id}/confirm-email` (BK-06). */
export interface OnSiteRequestConfirmation {
  bookingId: string;
  status: string;
  state: 'AwaitingGuestEmail' | 'AwaitingHostApproval' | null;
  requestExpiresAt: string | null;
  /** `XXXXX-XXXXX`: the code of the booking, once the backend sends it here (DB-06a); until then the page shows the reference as before. */
  bookingCode?: string | null;
}

/** Body of "Le mie prenotazioni" (BK-11) with the guest's email: the booking site, the booking code of the confirmation email, the email the booking was made with. */
export interface GuestBookingEmailLookup {
  orgSlug: string;
  bookingCode: string;
  email: string;
}

/**
 * Body of "Le mie prenotazioni" with the last four digits of the phone instead of the email (NF-143, E40): the same site and code, and `phoneLast4`, exactly four digits. The key `email` is
 * ABSENT from this body: the backend takes exactly one of the two proofs. The digits are personal data: they live in the memory of the form only, never in an address, in the storage of the
 * browser, in a query key or in a log.
 */
export interface GuestBookingPhoneLookup {
  orgSlug: string;
  bookingCode: string;
  phoneLast4: string;
}

/** What opens a guest session (`POST /api/public/guest/session`): the code with the email, or the code with the last four digits of the phone. */
export type GuestBookingLookupPayload = GuestBookingEmailLookup | GuestBookingPhoneLookup;

/**
 * A guest session with no account (DB-06a, `POST /api/public/guest/session`): the signed token the guest area expects as
 * `Authorization: Bearer`, until when it works (UTC instant; there is no refresh) and the booking the guest proved.
 * The same shape is what the page keeps in `sessionStorage`. The guest's email is never part of it.
 */
export interface GuestSession {
  accessToken: string;
  expiresAt: string;
  /** `XXXXX-XXXXX` */
  bookingCode: string;
}

/** State of a booking for its guest: the checkout outcome states plus the stay in progress / over. */
export type GuestBookingStatus =
  | CheckoutOutcomeState
  | 'StayInProgress'
  | 'StayCompleted';

/** Online check-in of the booking (CO-02): the link is only emailed, never shown. */
export type GuestCheckInAccessStatus = 'NotApplicable' | 'NotYetOpen' | 'Open' | 'Completed';

/**
 * One booking as its guest sees it (`GET /api/public/guest/bookings/{code}` with the guest session, DB-06a; the body of
 * `POST /api/public/bookings/lookup` is the same, BK-11). No personal data: amounts in `currency` as recorded on the
 * booking; the host contact is the one of the booking site.
 */
export interface GuestBookingDetails {
  /** `XXXXX-XXXXX` */
  bookingCode: string;
  status: GuestBookingStatus;
  paymentOption: PaymentOption;
  propertyId: string;
  propertySlug: string | null;
  propertyName: string;
  propertyCity: string | null;
  /** `YYYY-MM-DD` */
  checkInDate: string;
  /** `YYYY-MM-DD` */
  checkOutDate: string;
  numberOfAdults: number;
  numberOfChildren: number;
  lodging: number;
  cleaningFee: number;
  touristTax: number;
  totalPrice: number;
  paidAmount: number;
  refundedAmount: number;
  currency: string;
  /** Until when the guest can pay, or the request waits (UTC instant); null otherwise. */
  expiresAt: string | null;
  /** "Paga alla scadenza": day (`YYYY-MM-DD`) the saved card is charged. */
  deferredChargeDate: string | null;
  host: { name: string | null; email: string | null };
  checkIn: {
    status: GuestCheckInAccessStatus;
    /** `NotYetOpen`: day (`YYYY-MM-DD`) the link is emailed. */
    opensOn: string | null;
    /** When the link that still works was emailed (UTC instant). */
    linkSentAt: string | null;
  };
}

/** Where a checkout stands for the guest (`POST /api/public/bookings/{id}/outcome`, BK-07). */
export type CheckoutOutcomeState =
  | 'Confirmed'
  | 'AwaitingPayment'
  | 'PaymentProcessing'
  | 'PaymentFailed'
  | 'AwaitingGuestEmail'
  | 'AwaitingHostApproval'
  | 'Expired'
  | 'Declined'
  | 'DatesUnavailable'
  | 'Cancelled';

/** The real state of a checkout, read with its checkout token. No personal data of the guest. */
export interface CheckoutOutcome {
  bookingId: string;
  state: CheckoutOutcomeState;
  paymentOption: PaymentOption;
  propertyId: string;
  propertySlug: string | null;
  propertyName: string;
  /** `YYYY-MM-DD` */
  checkInDate: string;
  /** `YYYY-MM-DD` */
  checkOutDate: string;
  numberOfAdults: number;
  numberOfChildren: number;
  totalPrice: number;
  currency: string;
  /** Until when the guest can pay, or the request waits for the email / the host (UTC instant); null otherwise. */
  expiresAt: string | null;
  /** "Paga alla scadenza": day (`YYYY-MM-DD`) the saved card is charged. */
  deferredChargeDate: string | null;
  /** Booking code of "Le mie prenotazioni" (`XXXXX-XXXXX`, BK-11): the one of the confirmation email. */
  bookingCode: string;
}

/** `POST /api/public/bookings/{id}/payment-session` (BK-07): the same hold, to pay again. */
export interface CheckoutPaymentSession {
  bookingId: string;
  paymentOption: PaymentOption;
  clientSecret: string | null;
  setupIntentClientSecret: string | null;
  connectedAccountPublishableContext: ConnectedAccountPublishableContext;
  expiresAt: string;
}

export const DIRECT_CHECKOUT_CONSENT_VERSION = '2026-06-direct-checkout-v1';
