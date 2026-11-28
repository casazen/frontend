import type { CheckoutExtraOffer, CheckoutExtraSelection } from '@/types/direct-booking.types';
import { hasInternationalPrefix } from '@/features/public-booking/checkout/details-schema';
import { DIRECT_CHECKOUT_CONSENT_VERSION } from '@/types/direct-booking.types';
import type { CreateDirectBookingPayload, DirectBookingAttributionPayload, PaymentOption } from '@/types';

export type CheckoutMode = 'instant' | 'request';

export type PayChoice = 'now' | 'deadline';

export type CheckoutStep = 1 | 2 | 3;

export interface DetailsValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  arrival: string;
  offersEmail: boolean;
  offersWhatsApp: boolean;
}

export interface CheckoutDraft {
  extras?: CheckoutExtraSelection[];
  mode: CheckoutMode;
  pay: PayChoice;
  requests: string;
  childrenAges: (number | null)[];
  details: DetailsValues;
  consent: boolean;
}

export function checkoutExtraLines(offers: CheckoutExtraOffer[] = [], selections: CheckoutExtraSelection[] = [], mode: CheckoutMode) {
  return offers.flatMap((offer) => {
    const chosen = selections.find((selection) => selection.id === offer.id && selection.expectedUnitPrice === offer.unitPrice);
    if (!chosen || mode === 'request' || offer.requiresApproval) return [];
    return [{ id: offer.id, name: offer.name, quantity: chosen.quantity, cents: Math.round(offer.unitPrice * 100) * chosen.quantity }];
  });
}

export const EMPTY_DETAILS: DetailsValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  country: '',
  arrival: '',
  offersEmail: false,
  offersWhatsApp: false,
};

export const EMPTY_DRAFT: CheckoutDraft = {
  mode: 'instant',
  pay: 'now',
  requests: '',
  childrenAges: [],
  details: EMPTY_DETAILS,
  consent: false,
};

export const SPECIAL_REQUESTS_MAX = 1000;

export function paymentOptionOf(mode: CheckoutMode, pay: PayChoice): PaymentOption {
  if (mode === 'request') return 'OnSite';
  return pay === 'deadline' ? 'OnCancellationDeadline' : 'Immediate';
}

export function parseStep(value: string | null | undefined): CheckoutStep {
  return value === '2' ? 2 : value === '3' ? 3 : 1;
}

export function arrivalSlots(from: string, to: string): string[] {
  if (!from || !to) return [];
  const start = Number(from.slice(0, 2));
  const end = Number(to.slice(0, 2));
  if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) return [];
  return Array.from({ length: end - start }, (_, index) => `${String(start + index).padStart(2, '0')}:00`);
}

const POPULAR_DOMAINS = [
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.it', 'outlook.com', 'outlook.it', 'live.com', 'live.it', 'yahoo.com', 'yahoo.it',
  'icloud.com', 'me.com', 'libero.it', 'virgilio.it', 'tiscali.it', 'alice.it', 'tin.it', 'fastwebnet.it', 'pec.it', 'proton.me',
  'protonmail.com', 'gmx.com', 'gmx.de', 'gmx.net', 'gmx.ch', 'web.de', 't-online.de', 'orange.fr', 'free.fr', 'bluewin.ch', 'sunrise.ch',
  'ymail.com', 'aol.com', 'msn.com', 'mail.com', 'zoho.com', 'email.it', 'inwind.it', 'iol.it', 'poste.it', 'legalmail.it', 'hotmail.fr',
  'yahoo.fr', 'yahoo.de', 'yahoo.co.uk', 'hotmail.co.uk', 'live.co.uk', 'btinternet.com', 'sky.com',
] as const;

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

export const PETS_NOTE = 'Viaggia con animali domestici.';

interface BookingPayloadInput {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  pets?: boolean;
  childrenAges?: number[];
  draft: CheckoutDraft;
  marketingConsentVersion?: string | null;
  softOptInNoticeVersion?: string | null;
  attribution?: DirectBookingAttributionPayload;
}

/**
 * The body of the booking, as the API takes it. The stay and the amounts are not decided here: the server prices the same stay again
 * and charges its own total. The consent to the privacy notice is the one of the checkout (given in the last step); the ones to the
 * offers, one per channel (NF-90), are sent only when the site has a text for them, and are whatever the guest chose (never preselected;
 * WhatsApp never without the phone number it needs). The single `marketingConsent` of before is no longer sent. The soft opt-in notice
 * (art. 130 c. 4) is not a consent: only the version the page showed goes back, and only when the site has one. Where the guest came from (E27/F01/US02, NF-123)
 * goes with it as it is, when there is something to say: it is not the guest's data (a source, a campaign, the host of a site), and it changes no price.
 */
export function buildBookingPayload({
  propertyId,
  checkIn,
  checkOut,
  adults,
  children,
  pets = false,
  childrenAges,
  draft,
  marketingConsentVersion,
  softOptInNoticeVersion,
  attribution,
}: BookingPayloadInput): CreateDirectBookingPayload {
  const { details } = draft;
  const phone = details.phone.trim();
  const requests = [pets ? PETS_NOTE : '', draft.requests.trim()].filter(Boolean).join('\n');
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
    ...(draft.extras?.length ? { extras: draft.extras } : {}),
    paymentOption: paymentOptionOf(draft.mode, draft.pay),
    ...(requests ? { specialRequests: requests.slice(0, SPECIAL_REQUESTS_MAX) } : {}),
    ...(details.arrival ? { expectedArrivalTime: details.arrival } : {}),
    ...(marketingConsentVersion
      ? {
          marketingConsentEmail: details.offersEmail,
          marketingConsentWhatsApp: details.offersWhatsApp && phone !== '' && hasInternationalPrefix(phone),
        }
      : {}),
    ...(softOptInNoticeVersion ? { softOptInNoticeVersion } : {}),
    ...(attribution ? { attribution } : {}),
  };
}
