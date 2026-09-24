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
}

/** Answer of `POST /api/public/bookings/{id}/confirm-email` (BK-06). */
export interface OnSiteRequestConfirmation {
  bookingId: string;
  status: string;
  state: 'AwaitingGuestEmail' | 'AwaitingHostApproval' | null;
  requestExpiresAt: string | null;
}

export interface GuestBookingItem {
  bookingId: string;
  propertyName: string;
  propertyCity: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  paymentOption: string;
  freeRefundDeadline: string;
}

export interface GuestBookingLookupResponse {
  bookings: GuestBookingItem[];
}

export interface BookingStatusResponse {
  bookingId: string;
  status: string;
  paymentOption: string;
}

export const DIRECT_CHECKOUT_CONSENT_VERSION = '2026-06-direct-checkout-v1';
