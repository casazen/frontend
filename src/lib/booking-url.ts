import { createPath } from 'react-router-dom';
import { isStayDate } from '@/lib/stay-dates';

export function buildPropertyBookingPath(orgSlug: string, property: { id: string; slug?: string | null }): string {
  const segment = property.slug?.trim() || property.id;
  return `/book/${orgSlug}/property/${segment}`;
}

export function buildOrgBookingPath(orgSlug: string): string {
  return `/book/${orgSlug}`;
}

/** Mirrors the backend `PublicListing.IsPublished` (A2-05): a paused property is never publishable either. */
export function isPropertyPublishable(property: { isActive: boolean; isPaused: boolean; complianceStatus?: string }): boolean {
  return property.isActive && !property.isPaused && property.complianceStatus === 'Active';
}

/**
 * Query parameters of the itinerary deep link: `?checkin=YYYY-MM-DD&checkout=YYYY-MM-DD&guests=N`
 * (spec-branded-booking-site AC15, used by the Google Vacation Rentals deep links).
 * `children` is an optional extension: how many of the `guests` are children.
 */
export const BOOKING_QUERY_KEYS = {
  checkIn: 'checkin',
  checkOut: 'checkout',
  guests: 'guests',
  children: 'children',
} as const;

/** camelCase names written by older versions of the site: still read, never written. */
const LEGACY_QUERY_KEYS = { checkIn: 'checkIn', checkOut: 'checkOut' } as const;

export const DEFAULT_GUESTS = 2;

export interface BookingSearchParams {
  checkIn: string;
  checkOut: string;
  /** Total guests, children included. */
  guests: number;
  children: number;
}

function readCount(value: string | null): number | undefined {
  const text = value?.trim() ?? '';
  if (!/^\d{1,3}$/.test(text)) return undefined;
  return Number(text);
}

function readDate(search: URLSearchParams, key: string, legacyKey: string): string {
  const value = (search.get(key) ?? search.get(legacyKey) ?? '').trim();
  return isStayDate(value) ? value : '';
}

/** Reads the booking parameters, accepting both `checkin`/`checkout` and the legacy `checkIn`/`checkOut`. */
export function parseBookingSearchParams(search: URLSearchParams): BookingSearchParams {
  const guests = Math.max(1, readCount(search.get(BOOKING_QUERY_KEYS.guests)) ?? DEFAULT_GUESTS);
  const children = Math.min(readCount(search.get(BOOKING_QUERY_KEYS.children)) ?? 0, guests - 1);
  return {
    checkIn: readDate(search, BOOKING_QUERY_KEYS.checkIn, LEGACY_QUERY_KEYS.checkIn),
    checkOut: readDate(search, BOOKING_QUERY_KEYS.checkOut, LEGACY_QUERY_KEYS.checkOut),
    guests,
    children,
  };
}

/** Booking parameters in the deep link form (`checkin`, `checkout`, `guests`, `children` when > 0). */
export function buildBookingQuery(params: BookingSearchParams): URLSearchParams {
  const guests = Number.isFinite(params.guests) ? Math.max(1, Math.trunc(params.guests)) : DEFAULT_GUESTS;
  const children = Number.isFinite(params.children) ? Math.min(Math.max(0, Math.trunc(params.children)), guests - 1) : 0;
  const query = new URLSearchParams();
  if (params.checkIn) query.set(BOOKING_QUERY_KEYS.checkIn, params.checkIn);
  if (params.checkOut) query.set(BOOKING_QUERY_KEYS.checkOut, params.checkOut);
  query.set(BOOKING_QUERY_KEYS.guests, String(guests));
  if (children > 0) query.set(BOOKING_QUERY_KEYS.children, String(children));
  return query;
}

/**
 * `current` with the booking parameters updated by `next`: other parameters are kept and legacy
 * camelCase dates are rewritten in the deep link form.
 */
export function mergeBookingSearchParams(
  current: URLSearchParams,
  next: Partial<BookingSearchParams>,
): URLSearchParams {
  const merged = { ...parseBookingSearchParams(current), ...next };
  const result = new URLSearchParams(current);
  [...Object.values(BOOKING_QUERY_KEYS), ...Object.values(LEGACY_QUERY_KEYS)].forEach((key) => result.delete(key));
  buildBookingQuery(merged).forEach((value, key) => result.set(key, value));
  return result;
}

type PropertyRef = { id: string; slug?: string | null };

/** Property page URL carrying the selected stay. */
export function buildPropertyPageUrl(orgSlug: string, property: PropertyRef, params: BookingSearchParams): string {
  return createPath({
    pathname: buildPropertyBookingPath(orgSlug, property),
    search: buildBookingQuery(params).toString(),
  });
}

/** Checkout URL of a property carrying the selected stay. */
export function buildPropertyCheckoutUrl(orgSlug: string, property: PropertyRef, params: BookingSearchParams): string {
  return createPath({
    pathname: `${buildPropertyBookingPath(orgSlug, property)}/checkout`,
    search: buildBookingQuery(params).toString(),
  });
}

/**
 * Outcome page of a checkout (BK-07): the real state of the booking, read with its checkout token. Also the Stripe
 * `return_url` of the redirect payment methods, so the guest comes back to their booking, not to an empty checkout.
 */
export function buildCheckoutOutcomePath(orgSlug: string, bookingId: string, token: string): string {
  return createPath({
    pathname: `/book/${encodeURIComponent(orgSlug)}/booking/${encodeURIComponent(bookingId)}`,
    search: new URLSearchParams({ token }).toString(),
  });
}

/**
 * "Le mie prenotazioni" of the booking site (BK-11). With `bookingCode` the page opens with the code filled in and still
 * asks for the email before showing anything.
 */
export function buildGuestBookingsPath(orgSlug: string, bookingCode?: string | null): string {
  return createPath({
    pathname: `/book/${encodeURIComponent(orgSlug)}/my-bookings`,
    search: bookingCode ? new URLSearchParams({ code: bookingCode }).toString() : '',
  });
}
