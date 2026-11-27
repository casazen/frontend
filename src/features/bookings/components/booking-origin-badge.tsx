import { useTranslation } from 'react-i18next';
import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import { cn } from '@/lib/utils';
import type { Booking } from '@/types';
import { bookingOriginName } from '../lib/ota-stay';

/**
 * Where the booking came from (E27/F01/US02, NF-123), as the API works it out (`origin`): «Portale Airbnb», «Sito dell'agenzia» (a booking made from a link the agency
 * copied from CasaZen, or a reservation of its booking engine), «Sito CasaZen» or «Manuale». A word on a soft background, so it is never told by color alone; nothing at all
 * for an answer that has no origin (an older one) or an origin this client does not know.
 */
export function BookingOriginBadge({
  booking,
  className,
}: {
  booking: Pick<Booking, 'origin' | 'originChannel' | 'source' | 'icalFeedId' | 'channelLabel'>;
  className?: string;
}) {
  const { t } = useTranslation();
  const name = bookingOriginName(booking, t);
  if (!name) return null;

  return (
    <span
      data-testid="booking-origin-badge"
      data-origin={booking.origin}
      className={cn('inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', STATUS_TONE_CLASSES.neutral, className)}
    >
      <span className="min-w-0 break-words">{name}</span>
    </span>
  );
}
