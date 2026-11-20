import { OTA_STAY_SOURCES, type Booking } from '@/types';

/**
 * The portals the channel manager brings stays from, by the name of `BookingSource`: the six a stay can be made from a block of an iCal feed (`OTA_STAY_SOURCES`) and the portal that has no value
 * of its own (`OtherChannel`, named by the channel manager).
 */
const CHANNEL_SOURCES: readonly string[] = [...OTA_STAY_SOURCES, 'OtherChannel'];

/** The statuses of a stay that happens (the one definition of the product: a request, a hold and a cancelled booking are not). */
const STAY_STATUSES: readonly string[] = ['Confirmed', 'CheckedIn', 'CheckedOut'];

/** Which reviews a booking can have: the one of the booking site (`direct`) or the ones of a portal (`channel`). */
export type BookingReviewsKind = 'direct' | 'channel';

/**
 * Whether the page of a booking has a section for its reviews, and of which kind (E05/F06/US02, NF-69). A stay that does not happen (cancelled, still a request) has none. A booking made through
 * the site has one once its check-out day has passed (`today` is the Rome calendar day): the guest cannot review it before, and the host asks for the review there (DB-12b). A booking from a
 * portal has one only while the connector of the channel manager is on (`connectorOn`: with it off nothing is read, sent or said about it, and the section is not drawn and asks nothing), and
 * the answer says what its channel allows: Airbnb is read and answered, Booking.com, Vrbo and Expedia give no review and the section says so in one sentence. Any other booking (entered by
 * the host) has none.
 */
export function bookingReviewsKindOf(booking: Pick<Booking, 'source' | 'status' | 'checkOutDate'>, connectorOn: boolean, today: string): BookingReviewsKind | null {
  if (!STAY_STATUSES.includes(booking.status)) return null;
  if (booking.source === 'Direct') return booking.checkOutDate.slice(0, 10) < today ? 'direct' : null;
  return connectorOn && booking.source !== undefined && CHANNEL_SOURCES.includes(booking.source) ? 'channel' : null;
}
