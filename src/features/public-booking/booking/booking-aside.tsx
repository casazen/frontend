import { useTranslation } from 'react-i18next';
import { FROM_DESKTOP_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { BookingCard } from '@/features/public-booking/booking/booking-card';

export function BookingAside() {
  const { t } = useTranslation();
  const isDesktop = useMediaQuery(FROM_DESKTOP_QUERY);
  if (!isDesktop) return null;

  return (
    <aside
      id="booking-widget"
      aria-label={t('propertyBooking.aside')}
      className="lg:sticky lg:top-[calc(var(--header-height)+1.5rem)]"
    >
      <BookingCard />
    </aside>
  );
}
