import type { PublicSlot, PublicSupplierService, PublicSupplierServiceDetail } from '@/api/public-supplier.api';
import type { PublicBookingBody } from '@/api/public-supplier-booking.api';
import type { BookingParams } from './booking-params';
import { surfaceSupplement, defaultSelection, isPickedSupplement, maxUnits, type ServiceSelection } from './service-options';

/**
 * The booking in five steps (`/fornitori/:slug/prenota`, SP-12b): what the customer chose and typed, what each step needs to be done, and
 * how it all becomes the body the server holds a slot with. Pure: no clock, no storage, no network. The total is never computed here
 * (the server adds up the lines of the estimate) and the consent is never part of the draft (it is asked again every time).
 */

/** The comune picked from the official list, as far as the booking needs it. */
export interface DraftComune {
  istatCode: string;
  name: string;
  provinceCode: string;
}

export interface BookingDraft {
  /** Slug of the service. */
  service: string | null;
  /** Hours, sets or m² of the service's own price; null: the default of the service. */
  quantity: number | null;
  /** The m² of the home, for a service with a `sqm30` supplement; null: what the price covers. */
  surface: number | null;
  /** Units picked of each supplement. */
  options: Record<string, number>;
  /** The urgent slots (today and tomorrow, with a surcharge). */
  urgent: boolean;
  /**
   * The comune of the work. `undefined`: not chosen here, the one the address of the page named (`?comune=`) stands; `null`: chosen
   * to be empty. A JSON file cannot tell the two apart, which is fine: the address only seeds a new draft.
   */
  comune?: DraftComune | null;
  /** The slot, exactly as the server gave it. */
  startUtc: string | null;
  postalCode: string;
  address: string;
  floor: string;
  accessNotes: string;
  fullName: string;
  email: string;
  phone: string;
}

export const EMPTY_DRAFT: BookingDraft = {
  service: null,
  quantity: null,
  surface: null,
  options: {},
  urgent: false,
  startUtc: null,
  postalCode: '',
  address: '',
  floor: '',
  accessNotes: '',
  fullName: '',
  email: '',
  phone: '',
};

/** What the address of the page says (`?service=…&start=…`, from the cards and the finder of the site) as the start of a draft. */
export function draftFromParams(params: BookingParams): Partial<BookingDraft> {
  return {
    ...(params.service ? { service: params.service } : {}),
    ...(params.quantity !== undefined ? { quantity: params.quantity } : {}),
    ...(params.surface !== undefined ? { surface: params.surface } : {}),
    ...(params.options ? { options: Object.fromEntries(params.options.map((option) => [option.code, option.quantity])) } : {}),
    ...(params.start ? { startUtc: params.start } : {}),
  };
}

/** A service can be booked when it has a price; one on quote is asked for with a request on measure. */
export const isBookable = (service: PublicSupplierService) => !service.requiresQuote && service.priceFromCents !== null;

/** The steps, in order. The last one exists only for a booking whose card has to be blocked. */
export const BOOKING_STEPS = ['service', 'where', 'when', 'details', 'payment'] as const;
export type BookingStep = (typeof BOOKING_STEPS)[number];

/** The limits of the server (`ShowcaseBookingLimits`): a longer text is refused there, so the page stops it first. */
export const BOOKING_LIMITS = { address: 200, floor: 60, accessNotes: 500, fullName: 100, email: 254, phoneMinDigits: 6, phoneMaxDigits: 15 } as const;

/** What can be wrong with a field of the last step: the word the person reads is `supplierSite.booking.problems.<field>.<problem>`. */
export type DetailsField = 'address' | 'postalCode' | 'floor' | 'accessNotes' | 'fullName' | 'email' | 'phone' | 'consent';
export type FieldProblem = 'required' | 'invalid' | 'tooLong';
export type DetailsProblems = Partial<Record<DetailsField, FieldProblem>>;

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const POSTAL_CODE = /^\d{5}$/;

export function phoneDigits(value: string): number {
  return value.replace(/\D/g, '').length;
}

/** The problem of a name and surname, or null when it is fine. The request on measure (SP-12c) asks for the same three data. */
export function fullNameProblem(value: string): FieldProblem | null {
  const fullName = value.trim();
  if (!fullName) return 'required';
  if (fullName.length < 2 || !/\p{L}/u.test(fullName)) return 'invalid';
  return fullName.length > BOOKING_LIMITS.fullName ? 'tooLong' : null;
}

/** The problem of an e-mail address, or null when it is fine. */
export function emailProblem(value: string): FieldProblem | null {
  const email = value.trim();
  if (!email) return 'required';
  if (!EMAIL_SHAPE.test(email)) return 'invalid';
  return email.length > BOOKING_LIMITS.email ? 'tooLong' : null;
}

/** The problem of a phone number, or null when it is fine. */
export function phoneProblem(value: string): FieldProblem | null {
  const phone = value.trim();
  if (!phone) return 'required';
  const digits = phoneDigits(phone);
  return !/^\+?[\d\s().-]+$/.test(phone) || digits < BOOKING_LIMITS.phoneMinDigits || digits > BOOKING_LIMITS.phoneMaxDigits ? 'invalid' : null;
}

/** The problems of the last step; empty means the booking can be sent. The consent is the person's, given now, never remembered. */
export function validateDetails(draft: BookingDraft, consent: boolean): DetailsProblems {
  const problems: DetailsProblems = {};
  const address = draft.address.trim();
  if (!address) problems.address = 'required';
  else if (address.length > BOOKING_LIMITS.address) problems.address = 'tooLong';

  const postalCode = draft.postalCode.trim();
  if (!postalCode) problems.postalCode = 'required';
  else if (!POSTAL_CODE.test(postalCode)) problems.postalCode = 'invalid';

  if (draft.floor.trim().length > BOOKING_LIMITS.floor) problems.floor = 'tooLong';
  if (draft.accessNotes.trim().length > BOOKING_LIMITS.accessNotes) problems.accessNotes = 'tooLong';

  const fullName = fullNameProblem(draft.fullName);
  if (fullName) problems.fullName = fullName;
  const email = emailProblem(draft.email);
  if (email) problems.email = email;
  const phone = phoneProblem(draft.phone);
  if (phone) problems.phone = phone;

  if (!consent) problems.consent = 'required';
  return problems;
}

/** The common slips in the domain of an address: the page offers the right one and the person decides. */
const DOMAIN_SLIPS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmail.ti': 'hotmail.it',
  'libero.ti': 'libero.it',
  'virgilio.ti': 'virgilio.it',
  'yaho.com': 'yahoo.com',
  'yahoo.ti': 'yahoo.it',
  'outlok.com': 'outlook.com',
  'icloud.co': 'icloud.com',
};

/** The address with its domain corrected, when the domain is a known slip; null otherwise. */
export function suggestEmail(value: string): string | null {
  const text = value.trim();
  const at = text.lastIndexOf('@');
  if (at < 1) return null;
  const fixed = DOMAIN_SLIPS[text.slice(at + 1).toLowerCase()];
  return fixed ? `${text.slice(0, at)}@${fixed}` : null;
}

/**
 * What the draft stands for on the service the server described: a quantity only for a price that has one, a surface only for a service
 * with a `sqm30` supplement, only supplements the service has and within their limit. A link written by hand or an old draft can carry
 * choices that no longer fit; they are dropped here instead of being refused by the server.
 */
export function selectionOf(draft: BookingDraft, service: PublicSupplierServiceDetail, comuneIstat: string | null): ServiceSelection {
  const base = defaultSelection(service);
  const surface = surfaceSupplement(service);
  const options: Record<string, number> = {};
  for (const supplement of service.supplements.filter(isPickedSupplement)) {
    const units = draft.options[supplement.code];
    if (Number.isInteger(units) && units > 0) options[supplement.code] = Math.min(units, maxUnits(supplement));
  }
  return {
    quantity: base.quantity === null ? null : (draft.quantity ?? base.quantity),
    surface: surface ? (draft.surface ?? base.surface) : null,
    options,
    comune: comuneIstat,
  };
}

/** The urgent choice stands only for a service that offers it. */
export function isUrgent(draft: BookingDraft, service: PublicSupplierServiceDetail | undefined): boolean {
  return draft.urgent && service?.urgent.enabled === true;
}

/** Part of the day of a slot, by the clock of Rome. */
export type DayPart = 'morning' | 'afternoon' | 'evening';

/** `HH:mm` on the clock of Rome: `startLocal` already is that clock, with its offset after the seconds. */
export function slotClock(slot: PublicSlot): string {
  return slot.startLocal.slice(11, 16);
}

export function dayPartOf(slot: PublicSlot): DayPart {
  const hour = Number(slot.startLocal.slice(11, 13));
  if (hour < 13) return 'morning';
  return hour < 18 ? 'afternoon' : 'evening';
}

export interface BookingBodyInput {
  draft: BookingDraft;
  service: PublicSupplierServiceDetail;
  selection: ServiceSelection;
  comune: DraftComune;
  locale: string;
  privacyNoticeVersion: string;
  clientRequestId: string;
  /** What the trap field holds (a person leaves it empty). */
  trap: string;
}

/** The body the server holds a slot with. Only call it with a draft that passed {@link validateDetails} and has a service, a comune and a slot. */
export function toBookingBody(input: BookingBodyInput): PublicBookingBody {
  const { draft, service, selection, comune } = input;
  const options = Object.entries(selection.options)
    .filter(([, quantity]) => quantity > 0)
    .map(([code, quantity]) => ({ code, quantity }));
  const floor = draft.floor.trim();
  const accessNotes = draft.accessNotes.trim();
  return {
    clientRequestId: input.clientRequestId,
    service: service.slug,
    startUtc: draft.startUtc ?? '',
    ...(selection.quantity !== null ? { quantity: selection.quantity } : {}),
    ...(selection.surface !== null ? { surfaceSqm: selection.surface } : {}),
    ...(options.length > 0 ? { options } : {}),
    ...(isUrgent(draft, service) ? { urgent: true } : {}),
    comuneIstat: comune.istatCode,
    city: comune.name,
    postalCode: draft.postalCode.trim(),
    address: draft.address.trim(),
    ...(floor ? { floor } : {}),
    ...(accessNotes ? { accessNotes } : {}),
    fullName: draft.fullName.trim(),
    email: draft.email.trim(),
    phone: draft.phone.trim(),
    locale: input.locale.toLowerCase().startsWith('en') ? 'en' : 'it',
    privacyAccepted: true,
    privacyNoticeVersion: input.privacyNoticeVersion,
    website: input.trap,
  };
}

/**
 * An id for one attempt, a guid like the server wants. The same id is the same booking, so it is made once per attempt and kept for a
 * retry of the very same request after a lost answer; a changed request gets a new one.
 */
export function newClientRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
