import { DIRECT_CHECKOUT_CONSENT_VERSION } from '@/types/direct-booking.types';
import type { CreateDirectBookingPayload, PaymentOption } from '@/types';

/**
 * The checkout in three steps (DB-05), without a screen: what the guest chose, the steps and the body of the booking that is sent.
 * Pure: no React, no network.
 */

/** «Prenotazione immediata» (pay now or later, confirmed at once) or «Su richiesta» (the host accepts or refuses, paid on arrival). */
export type CheckoutMode = 'instant' | 'request';

/** Of an instant booking: pay now, or save the card now and be charged on the day the quote gives (`deferredChargeDate`). */
export type PayChoice = 'now' | 'deadline';

export type CheckoutStep = 1 | 2 | 3;

/** What step 2 asks; none of it goes in the address. */
export interface DetailsValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  /** `HH:mm`, `late` (after the check-in window) or empty (not said). Only a note for the host. */
  arrival: string;
  /** The optional «send me offers» box: never ticked for the guest. */
  offers: boolean;
}

/** Everything the guest has chosen and typed across the three steps, kept while they move between them. */
export interface CheckoutDraft {
  mode: CheckoutMode;
  pay: PayChoice;
  requests: string;
  /** One slot per child, null until chosen. */
  childrenAges: (number | null)[];
  details: DetailsValues;
  /** Terms and privacy: asked in the last step, never preselected. */
  consent: boolean;
}

export const EMPTY_DETAILS: DetailsValues = { firstName: '', lastName: '', email: '', phone: '', country: '', arrival: '', offers: false };

export const EMPTY_DRAFT: CheckoutDraft = {
  mode: 'instant',
  pay: 'now',
  requests: '',
  childrenAges: [],
  details: EMPTY_DETAILS,
  consent: false,
};

/** The longest note for the host that the API takes (`CreateDirectBookingRequest.SpecialRequests`). */
export const SPECIAL_REQUESTS_MAX = 1000;

/** The payment option of the API for what the guest chose. */
export function paymentOptionOf(mode: CheckoutMode, pay: PayChoice): PaymentOption {
  if (mode === 'request') return 'OnSite';
  return pay === 'deadline' ? 'OnCancellationDeadline' : 'Immediate';
}

/** The step the address asks for (`?step=2`); anything else is the first. */
export function parseStep(value: string | null | undefined): CheckoutStep {
  return value === '2' ? 2 : value === '3' ? 3 : 1;
}

/** The hours of the check-in window as arrival options (`HH:00`), from the first hour to the last one that is whole. */
export function arrivalSlots(from: string, to: string): string[] {
  const start = Number(from.slice(0, 2));
  const end = Number(to.slice(0, 2));
  if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) return [];
  return Array.from({ length: end - start }, (_, index) => `${String(start + index).padStart(2, '0')}:00`);
}

const POPULAR_DOMAINS = [
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.it', 'outlook.com', 'outlook.it', 'live.com', 'live.it', 'yahoo.com', 'yahoo.it',
  'icloud.com', 'me.com', 'libero.it', 'virgilio.it', 'tiscali.it', 'alice.it', 'tin.it', 'fastwebnet.it', 'pec.it', 'proton.me',
  'protonmail.com', 'gmx.com', 'gmx.de', 'gmx.net', 'gmx.ch', 'web.de', 't-online.de', 'orange.fr', 'free.fr', 'bluewin.ch', 'sunrise.ch',
  // Real providers that sit one letter from a popular one: never "corrected".
  'ymail.com', 'aol.com', 'msn.com', 'mail.com', 'zoho.com', 'email.it', 'inwind.it', 'iol.it', 'poste.it', 'legalmail.it', 'hotmail.fr',
  'yahoo.fr', 'yahoo.de', 'yahoo.co.uk', 'hotmail.co.uk', 'live.co.uk', 'btinternet.com', 'sky.com',
] as const;

/** The edit distance between two short words: an insertion, a deletion, a change or two letters swapped («gmial») count one. */
function editDistance(a: string, b: string): number {
  const table = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      table[i][j] = Math.min(table[i - 1][j] + 1, table[i][j - 1] + 1, table[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) table[i][j] = Math.min(table[i][j], table[i - 2][j - 2] + 1);
    }
  }
  return table[a.length][b.length];
}

/**
 * The address the guest probably meant when the domain of the one they typed is a typo of a popular provider («gmial.com», «hotmial.it»),
 * else null. It only suggests: the guest taps it or keeps theirs, and an address that looks right is never touched.
 */
export function suggestEmail(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain.includes('.') || (POPULAR_DOMAINS as readonly string[]).includes(domain)) return null;

  let best: { domain: string; distance: number } | null = null;
  for (const candidate of POPULAR_DOMAINS) {
    const distance = editDistance(domain, candidate);
    const allowed = candidate.length >= 10 ? 2 : 1;
    if (distance >= 1 && distance <= allowed && (!best || distance < best.distance)) best = { domain: candidate, distance };
  }
  return best ? `${local}@${best.domain}` : null;
}

interface BookingPayloadInput {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  /** The ages when every child has one and the tax asks for them; else nothing. */
  childrenAges?: number[];
  draft: CheckoutDraft;
  /** The version of the offers consent the site carries: the box exists, and its answer is sent, only when there is one. */
  marketingConsentVersion?: string | null;
}

/**
 * The body of the booking, as the API takes it. The stay and the amounts are not decided here: the server prices the same stay again
 * and charges its own total. The consent to the privacy notice is the one of the checkout (given in the last step); the one to the
 * offers is sent only when the site has a text for it, and is whatever the guest chose (never preselected).
 */
export function buildBookingPayload({
  propertyId,
  checkIn,
  checkOut,
  adults,
  children,
  childrenAges,
  draft,
  marketingConsentVersion,
}: BookingPayloadInput): CreateDirectBookingPayload {
  const { details } = draft;
  const phone = details.phone.trim();
  const requests = draft.requests.trim();
  return {
    propertyId,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    numberOfAdults: adults,
    numberOfChildren: children,
    ...(childrenAges && childrenAges.length > 0 ? { childrenAges } : {}),
    guest: {
      firstName: details.firstName.trim(),
      lastName: details.lastName.trim(),
      email: details.email.trim(),
      ...(phone ? { phone } : {}),
      country: details.country,
    },
    consent: { dataProcessing: true, consentVersion: DIRECT_CHECKOUT_CONSENT_VERSION },
    paymentOption: paymentOptionOf(draft.mode, draft.pay),
    ...(requests ? { specialRequests: requests.slice(0, SPECIAL_REQUESTS_MAX) } : {}),
    ...(details.arrival ? { expectedArrivalTime: details.arrival } : {}),
    ...(marketingConsentVersion ? { marketingConsent: details.offers } : {}),
  };
}
