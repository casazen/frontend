import type { TouristTaxQuoteStatus } from './tourist-tax.types';

interface DirectBookingGuestPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  country: string;
}

interface DirectBookingConsentPayload {
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
  childrenAges?: number[];
  expectedArrivalTime?: string;
  marketingConsentEmail?: boolean;
  marketingConsentWhatsApp?: boolean;
  softOptInNoticeVersion?: string;
  attribution?: DirectBookingAttributionPayload;
}

export interface DirectBookingQuotePayload {
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfAdults: number;
  numberOfChildren: number;
  childrenAges?: number[];
}

interface TouristTaxQuote {
  status: TouristTaxQuoteStatus;
  amount: number | null;
  taxableNights: number;
  ageRulesApply: boolean;
  categories: string[];
}

interface DirectBookingPaymentOptions {
  deferredPaymentAvailable: boolean;
  deferredChargeDate: string | null;
  freeCancellationUntil: string | null;
}

type QuoteLineKind = 'Nights' | 'WeekendNights' | 'CleaningFee' | 'TouristTax' | 'Total' | 'Discount';

export interface QuoteLine {
  kind: QuoteLineKind;
  quantity: number | null;
  unitAmountCents: number | null;
  amountCents: number;
}

interface StayCancellation {
  fullRefundUntil: string | null;
  partialRefundPercent: number | null;
  partialRefundUntil: string | null;
  selfServiceAvailable: boolean;
}

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
  totalPrice: number;
  currency: string;
  paymentOptions: DirectBookingPaymentOptions;
  lines?: QuoteLine[];
  cancellation?: StayCancellation | null;
}

interface ConnectedAccountPublishableContext {
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
  emailConfirmationExpiresAt?: string | null;
  checkoutToken: string;
}

export interface OnSiteRequestConfirmation {
  bookingId: string;
  status: string;
  state: 'AwaitingGuestEmail' | 'AwaitingHostApproval' | null;
  requestExpiresAt: string | null;
  bookingCode?: string | null;
}

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

export type GuestBookingLookupPayload = GuestBookingEmailLookup | GuestBookingPhoneLookup;

/**
 * A guest session with no account (DB-06a, `POST /api/public/guest/session`): the signed token the guest area expects as
 * `Authorization: Bearer`, until when it works (UTC instant; there is no refresh) and the booking the guest proved.
 * The same shape is what the page keeps in `sessionStorage`. The guest's email is never part of it.
 */
export interface GuestSession {
  accessToken: string;
  expiresAt: string;
  bookingCode: string;
}

export type GuestBookingStatus =
  | CheckoutOutcomeState
  | 'StayInProgress'
  | 'StayCompleted';

type GuestCheckInAccessStatus = 'NotApplicable' | 'NotYetOpen' | 'Open' | 'Completed';

/**
 * One booking as its guest sees it (`GET /api/public/guest/bookings/{code}` with the guest session, DB-06a; the body of
 * `POST /api/public/bookings/lookup` is the same, BK-11). No personal data: amounts in `currency` as recorded on the
 * booking; the host contact is the one of the booking site.
 */
export interface GuestBookingDetails {
  bookingCode: string;
  status: GuestBookingStatus;
  paymentOption: PaymentOption;
  propertyId: string;
  propertySlug: string | null;
  propertyName: string;
  propertyCity: string | null;
  checkInDate: string;
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
  deferredChargeDate: string | null;
  host: { name: string | null; email: string | null };
  checkIn: {
    status: GuestCheckInAccessStatus;
    opensOn: string | null;
    linkSentAt: string | null;
  };
}

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

export interface CheckoutOutcome {
  bookingId: string;
  state: CheckoutOutcomeState;
  paymentOption: PaymentOption;
  propertyId: string;
  propertySlug: string | null;
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfAdults: number;
  numberOfChildren: number;
  totalPrice: number;
  currency: string;
  /** Until when the guest can pay, or the request waits for the email / the host (UTC instant); null otherwise. */
  expiresAt: string | null;
  deferredChargeDate: string | null;
  bookingCode: string;
}

export interface CheckoutPaymentSession {
  bookingId: string;
  paymentOption: PaymentOption;
  clientSecret: string | null;
  setupIntentClientSecret: string | null;
  connectedAccountPublishableContext: ConnectedAccountPublishableContext;
  expiresAt: string;
}

export const DIRECT_CHECKOUT_CONSENT_VERSION = '2026-06-direct-checkout-v1';
