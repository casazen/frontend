import type { Booking } from '@/types';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * Channel of an OTA stay created from an iCal block (CO-21), shown next to its source: "iCal · camera 2", or "iCal"
 * when its feed has no label. Null for every other booking.
 */
export function bookingChannelText(
  booking: Pick<Booking, 'icalFeedId' | 'channelLabel'>,
  t: TranslateFn,
): string | null {
  if (!booking.icalFeedId && !booking.channelLabel) return null;
  return booking.channelLabel
    ? t('booking.otaStay.channelWithLabel', { label: booking.channelLabel })
    : t('booking.otaStay.channelIcal');
}

/** The OTA stay is "da verificare" (CO-21): a sync found its block gone from the feed or with other dates. */
export function needsOtaReview(booking: Pick<Booking, 'otaReviewReason' | 'status'>): boolean {
  return !!booking.otaReviewReason && booking.status !== 'Cancelled';
}
