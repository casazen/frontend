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

export interface CreateDirectBookingPayload {
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
  /** The guest ticked the optional «send me offers» box. Only sent when the site has a version of its text (`marketingConsentVersion`). */
  marketingConsent?: boolean;
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

/** Body of "Le mie prenotazioni" (BK-11): the booking site, the booking code of the confirmation email, the guest's email. */
export interface GuestBookingLookupPayload {
  orgSlug: string;
  bookingCode: string;
  email: string;
}

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
