import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/shared/error-state';
import { Timeline } from '@/components/shared/timeline/timeline';
import { SkeletonLine } from '@/components/ui/skeleton';
import { useBookingTimeline } from '@/queries/use-bookings';
import { timelineEventsOf } from '../lib/booking-timeline';

interface BookingTimelineSectionProps {
  bookingId: string;
  currency: string;
}

export function BookingTimelineSection({ bookingId, currency }: BookingTimelineSectionProps) {
  const { t, i18n } = useTranslation();
  const { data, isError, error, refetch } = useBookingTimeline(bookingId);

  if (isError) {
    return <ErrorState testId="booking-timeline-error" title={t('booking.timeline.loadError')} error={error} onRetry={() => void refetch()} />;
  }
  if (!data) return <SkeletonLine lines={4} />;

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
