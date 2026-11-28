import { createPath } from 'react-router-dom';
import { isStayDate } from '@/lib/stay-dates';

export function buildPropertyBookingPath(orgSlug: string, property: { id: string; slug?: string | null }): string {
  const segment = property.slug?.trim() || property.id;
  return `/book/${orgSlug}/property/${segment}`;
}

export function buildOrgBookingPath(orgSlug: string): string {
  return `/book/${orgSlug}`;
}

export function buildPropertyCheckoutPath(orgSlug: string, property: { id: string; slug?: string | null }): string {
  return `${buildPropertyBookingPath(orgSlug, property)}/checkout`;
}

export function isPropertyPublishable(property: { isActive: boolean; isPaused: boolean; complianceStatus?: string }): boolean {
  return property.isActive && !property.isPaused && property.complianceStatus === 'Active';
}

export const BOOKING_QUERY_KEYS = {
  checkIn: 'checkin',
  checkOut: 'checkout',
  guests: 'guests',
  children: 'children',
} as const;

const LEGACY_QUERY_KEYS = { checkIn: 'checkIn', checkOut: 'checkOut' } as const;

export const DEFAULT_GUESTS = 2;

export interface BookingSearchParams {
  checkIn: string;
  checkOut: string;
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

export function buildPropertyPageUrl(orgSlug: string, property: PropertyRef, params: BookingSearchParams): string {
  return createPath({
    pathname: buildPropertyBookingPath(orgSlug, property),
    search: buildBookingQuery(params).toString(),
  });
}

export function buildPropertyCheckoutUrl(orgSlug: string, property: PropertyRef, params: BookingSearchParams): string {
  return createPath({
    pathname: buildPropertyCheckoutPath(orgSlug, property),
    search: buildBookingQuery(params).toString(),
  });
}

export function buildCheckoutOutcomePath(orgSlug: string, bookingId: string, token: string): string {
  return createPath({
    pathname: `/book/${encodeURIComponent(orgSlug)}/booking/${encodeURIComponent(bookingId)}`,
    search: new URLSearchParams({ token }).toString(),
  });
}

export function buildGuestBookingsPath(orgSlug: string, bookingCode?: string | null): string {
  return createPath({
    pathname: `/book/${encodeURIComponent(orgSlug)}/my-bookings`,
    search: bookingCode ? new URLSearchParams({ code: bookingCode }).toString() : '',
  });
}
