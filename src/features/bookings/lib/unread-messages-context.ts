import { createContext, useContext } from 'react';

const EMPTY: ReadonlyMap<string, number> = new Map();

/**
 * The guest messages the host has not read, per booking (`GET /api/messages/unread`): a page that draws bookings (calendar,
 * timeline, lists) reads them once with `useUnreadMessagesByBooking` and offers the map here, so that no item asks for its own.
 * Without a provider (a test, a page that does not offer it) no booking has unread messages.
 */
export const UnreadMessagesContext = createContext<ReadonlyMap<string, number>>(EMPTY);

/** How many unread guest messages the booking has; 0 when none or when nobody offered the counts. */
export function useUnreadMessagesOf(bookingId: string | null | undefined): number {
  const map = useContext(UnreadMessagesContext);
  return bookingId ? (map.get(bookingId) ?? 0) : 0;
}
