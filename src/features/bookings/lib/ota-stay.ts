import { BedDouble, Building2, Compass, Globe, House, Pencil, Plane, Plug, TreePalm, type LucideIcon } from 'lucide-react';
import { getBookingSourceLabel } from '@/lib/i18n-labels';
import type { Booking, BookingChannel } from '@/types';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * The icon of each channel a booking can come from, in the list, in its filter and in the facts: the portals have one of their own,
 * so a channel is never told by its name alone, and the name always goes beside the icon.
 */
export const CHANNEL_ICONS: Record<BookingChannel, LucideIcon> = {
  Direct: Globe,
  Manual: Pencil,
  Airbnb: House,
  BookingCom: Building2,
  Expedia: Plane,
  Vrbo: TreePalm,
  TripAdvisor: Compass,
  Agoda: BedDouble,
  Other: Plug,
};

/**
 * The channel a value stands for: a `BookingChannel` or the exact source of a booking (their names coincide). A value no channel is
 * named after, such as a channel a newer API sends, is "another channel". Index `CHANNEL_ICONS` with it to draw the icon.
 */
export function channelOf(channelOrSource: string | null | undefined): BookingChannel {
  return channelOrSource && Object.hasOwn(CHANNEL_ICONS, channelOrSource) ? (channelOrSource as BookingChannel) : 'Other';
}

/** The name of a channel (`booking.channels.*`); a value this client does not know yet is shown as it came, never as a raw key. */
export function bookingChannelName(channel: BookingChannel | string, t: TranslateFn): string {
  return Object.hasOwn(CHANNEL_ICONS, channel) ? t(`booking.channels.${channel}`) : channel;
}

/**
 * Channel of an OTA stay created from an iCal block (CO-21), shown next to its source: "iCal · camera 2", or "iCal"
 * when its feed has no label. Null for every other booking: only a stay made from a block has a feed (`icalFeedId`, kept after the
 * calendar is disconnected), and the `channelLabel` of any other booking is not the label of a feed (see `bookingSourceName`).
 */
export function bookingChannelText(
  booking: Pick<Booking, 'icalFeedId' | 'channelLabel'>,
  t: TranslateFn,
): string | null {
  if (!booking.icalFeedId) return null;
  return booking.channelLabel
    ? t('booking.otaStay.channelWithLabel', { label: booking.channelLabel })
    : t('booking.otaStay.channelIcal');
}

/**
 * The name of where a booking came from, as the list and the facts write it: the label of its exact source (`booking.source.*`).
 * A booking the channel manager brought in from a portal that has no source of its own (`OtherChannel`) is told by the name the channel
 * manager gave that portal, which the API sends in `channelLabel`; without one it is "another portal". For a stay made from an iCal
 * block `channelLabel` is the label of its feed, which `bookingChannelText` writes beside the name: never the name itself.
 */
export function bookingSourceName(booking: Pick<Booking, 'source' | 'icalFeedId' | 'channelLabel'>, t: TranslateFn): string {
  if (booking.source === 'OtherChannel' && !booking.icalFeedId && booking.channelLabel) return booking.channelLabel;
  return getBookingSourceLabel(booking.source, t);
}

/** The OTA stay is "da verificare" (CO-21): a sync found its block gone from the feed or with other dates. */
export function needsOtaReview(booking: Pick<Booking, 'otaReviewReason' | 'status'>): boolean {
  return !!booking.otaReviewReason && booking.status !== 'Cancelled';
}
