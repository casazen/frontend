import { BedDouble, Building2, Compass, Globe, House, Pencil, Plane, Plug, TreePalm, type LucideIcon } from 'lucide-react';
import { getBookingSourceLabel } from '@/lib/i18n-labels';
import { BOOKING_ORIGINS, type Booking, type BookingChannel } from '@/types';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

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

export function channelOf(channelOrSource: string | null | undefined): BookingChannel {
  return channelOrSource && Object.hasOwn(CHANNEL_ICONS, channelOrSource) ? (channelOrSource as BookingChannel) : 'Other';
}

export function bookingChannelName(channel: BookingChannel | string, t: TranslateFn): string {
  return Object.hasOwn(CHANNEL_ICONS, channel) ? t(`booking.channels.${channel}`) : channel;
}

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

/**
 * Where a booking came from, in the words the host reads (E27/F01/US01/T01, NF-123): «Portale Airbnb» (a portal, by its name: `bookingSourceName`, so a portal with no
 * source of its own is told by the name the channel manager gave it), «Sito dell'agenzia», «Sito CasaZen» or «Manuale» (`booking.origin.*`). `null` when the answer has no
 * origin (an older one) or one this client does not know: nothing is drawn, never a raw value.
 */
export function bookingOriginName(
  booking: Pick<Booking, 'origin' | 'originChannel' | 'source' | 'icalFeedId' | 'channelLabel'>,
  t: TranslateFn,
): string | null {
  const { origin } = booking;
  if (!origin || !(BOOKING_ORIGINS as readonly string[]).includes(origin)) return null;
  if (origin !== 'Portal') return t(`booking.origin.${origin}`);

  const portal = booking.originChannel ?? booking.source;
  const name = portal ? bookingSourceName({ ...booking, source: portal }, t) : null;
  return name && name !== getBookingSourceLabel('OtherChannel', t) ? t('booking.origin.PortalNamed', { name }) : t('booking.origin.Portal');
}

export function needsOtaReview(booking: Pick<Booking, 'otaReviewReason' | 'status'>): boolean {
  return !!booking.otaReviewReason && booking.status !== 'Cancelled';
}
