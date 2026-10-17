import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/shared/error-state';
import { Timeline } from '@/components/shared/timeline/timeline';
import { SkeletonLine } from '@/components/ui/skeleton';
import { useBookingTimeline } from '@/queries/use-bookings';
import { timelineEventsOf } from '../lib/booking-timeline';

interface BookingTimelineSectionProps {
  bookingId: string;
  /** The currency of the booking: the entries carry amounts, not the currency. */
  currency: string;
}

/**
 * The history of a booking (SR-05c), the same in the sheet and in the drawer: what happened and what the booking waits for, in the
 * order the server gives (oldest first). The amounts are there for who may read payments; for the others the entry says that
 * the money came in, without the figure.
 */
export function BookingTimelineSection({ bookingId, currency }: BookingTimelineSectionProps) {
  const { t, i18n } = useTranslation();
  const { data, isError, error, refetch } = useBookingTimeline(bookingId);

  if (isError) {
    return <ErrorState testId="booking-timeline-error" title={t('booking.timeline.loadError')} error={error} onRetry={() => void refetch()} />;
  }
  if (!data) return <SkeletonLine lines={4} />;

  // Every entry, however many: the list is short and its end is where the booking stands now.
  return (
    <Timeline
      events={timelineEventsOf(data.events, t, i18n, currency)}
      order="given"
      limit={Infinity}
      label={t('booking.timeline.label')}
      testId="booking-timeline"
    />
  );
}
