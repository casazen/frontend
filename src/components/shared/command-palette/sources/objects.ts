import type { QueryClient } from '@tanstack/react-query';
import { CalendarDays, Home, User } from 'lucide-react';
import type { AppContextKey } from '@/config/route-manifest';
import { formatStayDate, parseStayDate } from '@/lib/stay-dates';
import type { CommandContext, CommandItem, CommandSource } from '../types';
import { openablePage, pathWithId } from './availability';

/**
 * The properties, the bookings and the guests the pages have already loaded (UI-06). The palette reads the cache of the
 * queries (TanStack Query) and never asks the server: what the user has not opened yet is not here until the server search
 * (UI-13) exists. Only what the pages put in the cache is read, so the server has already decided what the user may see.
 *
 * Privacy: the second line of a guest is empty (a name is all the palette says of a person); a booking says the property and
 * the dates of the stay, a property the city. No e-mail, phone, document, address or amount is shown, nor used to find
 * anything.
 */

/** The cache entries (by the first element of their query key) that hold each kind of object. */
const CACHE_ROOTS = { property: 'properties', booking: 'bookings', guest: 'guests' } as const;

/** The detail page of a property in each area that has one, in the order tried when the area the user is in has none. */
const PROPERTY_PAGES: ReadonlyArray<{ area: AppContextKey; pattern: string }> = [
  { area: 'short-rent', pattern: '/app/short-rent/properties/:id' },
  { area: 'long-rent', pattern: '/app/long-rent/properties/:id' },
];
const BOOKING_PAGE = '/app/short-rent/bookings/:id';
const GUEST_PAGE = '/app/short-rent/guests/:id';

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** The rows a cached answer holds: a list, a page (`{ items }`) or a single record. */
function rowsOf(data: unknown): Row[] {
  if (Array.isArray(data)) return data.filter(isRow);
  if (isRow(data) && Array.isArray(data.items)) return data.items.filter(isRow);
  return isRow(data) ? [data] : [];
}

/** The answers cached under `root`, the oldest first, so that when a record is in two of them the newer one wins. */
function cachedRows(client: QueryClient, root: string): Row[] {
  return client
    .getQueryCache()
    .findAll({ queryKey: [root] })
    .filter((query) => query.state.status === 'success' && query.state.data !== undefined)
    .sort((a, b) => a.state.dataUpdatedAt - b.state.dataUpdatedAt)
    .flatMap((query) => rowsOf(query.state.data));
}

interface Seen {
  properties: Map<string, { name: string; city: string }>;
  bookings: Map<string, { guest: string; property: string; from: string; to: string }>;
  guests: Map<string, { name: string }>;
}

/**
 * Sorts the cached rows by their shape, since the same root holds more than one kind (`['properties', id, 'documents']` is a
 * list of documents): a property has a name and a city, a booking a property, two stay dates and a guest, a guest a first and
 * a last name and no property.
 */
function collect(client: QueryClient): Seen {
  const seen: Seen = { properties: new Map(), bookings: new Map(), guests: new Map() };

  for (const row of cachedRows(client, CACHE_ROOTS.property)) {
    const id = text(row.id);
    const name = text(row.name);
    if (id && name && typeof row.city === 'string') seen.properties.set(id, { name, city: text(row.city) });
  }

  for (const row of cachedRows(client, CACHE_ROOTS.booking)) {
    const id = text(row.id);
    if (!id || !text(row.propertyId) || !text(row.checkInDate) || !text(row.checkOutDate) || !isRow(row.guest)) continue;
    seen.bookings.set(id, {
      guest: [text(row.guest.firstName), text(row.guest.lastName)].filter(Boolean).join(' '),
      property: text(row.propertyName),
      from: parseStayDate(text(row.checkInDate)),
      to: parseStayDate(text(row.checkOutDate)),
    });
  }

  for (const row of cachedRows(client, CACHE_ROOTS.guest)) {
    const id = text(row.id);
    const name = [text(row.firstName), text(row.lastName)].filter(Boolean).join(' ');
    if (id && name && !('propertyId' in row)) seen.guests.set(id, { name });
  }

  return seen;
}

/** "20 ott – 23 ott", or nothing when the stay has no valid dates. */
function stayLabel(context: CommandContext, from: string, to: string): string {
  if (!from || !to) return '';
  const style: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return context.t('commandPalette.stay.dates', {
    from: formatStayDate(from, context.locale, style),
    to: formatStayDate(to, context.locale, style),
  });
}

/** Where a property leads: the detail page of the area the user is in, else of the first area that has one the user may open. */
function propertyDestination(context: CommandContext) {
  const inThisArea = PROPERTY_PAGES.filter((page) => page.area === context.activeArea);
  const elsewhere = PROPERTY_PAGES.filter((page) => page.area !== context.activeArea);
  for (const { pattern } of [...inThisArea, ...elsewhere]) {
    const page = openablePage(context, pattern);
    if (page) return { pattern, area: page.context };
  }
  return null;
}

function objectCommands(context: CommandContext): CommandItem[] {
  const client = context.queryClient;
  if (!client) return [];

  const seen = collect(client);
  const items: CommandItem[] = [];

  const propertyPage = propertyDestination(context);
  if (propertyPage) {
    for (const [id, property] of seen.properties) {
      items.push({
        id: `property:${id}`,
        kind: 'property',
        label: property.name,
        subtitle: property.city || undefined,
        icon: Home,
        to: pathWithId(propertyPage.pattern, id),
        area: propertyPage.area,
      });
    }
  }

  const bookingPage = openablePage(context, BOOKING_PAGE);
  if (bookingPage) {
    for (const [id, booking] of seen.bookings) {
      const subtitle = [booking.property, stayLabel(context, booking.from, booking.to)].filter(Boolean).join(' · ');
      items.push({
        id: `booking:${id}`,
        kind: 'booking',
        label: booking.guest || context.t('commandPalette.fallbacks.booking'),
        subtitle: subtitle || undefined,
        icon: CalendarDays,
        to: pathWithId(BOOKING_PAGE, id),
        area: bookingPage.context,
      });
    }
  }

  const guestPage = openablePage(context, GUEST_PAGE);
  if (guestPage) {
    for (const [id, guest] of seen.guests) {
      items.push({
        id: `guest:${id}`,
        kind: 'guest',
        label: guest.name,
        icon: User,
        to: pathWithId(GUEST_PAGE, id),
        area: guestPage.context,
      });
    }
  }

  return items;
}

export const objectsSource: CommandSource = { id: 'objects', getItems: objectCommands };
