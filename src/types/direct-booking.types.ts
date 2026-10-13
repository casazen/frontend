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
   * Last day (`YYYY-MM-DD`) the guest can cancel for free by themselves; null while the guest has no self-service
   * cancellation (today: only the host cancels). "Cancellazione gratuita fino a…" is shown only when set.
   */
  freeCancellationUntil: string | null;
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
}

/** Body of "Le mie prenotazioni" (BK-11): the booking site, the booking code of the confirmation email, the guest's email. */
export interface GuestBookingLookupPayload {
  orgSlug: string;
  bookingCode: string;
  email: string;
}

/** State of a booking for its guest: the checkout outcome states plus the stay in progress / over. */
export type GuestBookingStatus =
  | CheckoutOutcomeState
  | 'StayInProgress'
  | 'StayCompleted';

/** Online check-in of the booking (CO-02): the link is only emailed, never shown. */
export type GuestCheckInAccessStatus = 'NotApplicable' | 'NotYetOpen' | 'Open' | 'Completed';

/**
 * One booking as its guest sees it (`POST /api/public/bookings/lookup`, BK-11). No personal data: amounts in `currency`
 * as recorded on the booking; the host contact is the one of the booking site.
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
