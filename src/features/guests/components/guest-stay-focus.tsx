import { useTranslation } from 'react-i18next';
import { FocusBlock } from '@/components/shared/calm';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { bookingNights } from '@/features/bookings/lib/booking-price';
import { BOOKINGS_PATH } from '@/features/bookings/lib/booking-list-query';
import { todayInRome } from '@/lib/stay-dates';
import { stayRangeText, type GuestFocusStay, type GuestStayPhase } from '../lib/guest-stays';

const KICKER: Record<GuestStayPhase, string> = {
  inProgress: 'guests.detailPage.focus.inProgress',
  upcoming: 'guests.detailPage.focus.upcoming',
  past: 'guests.detailPage.focus.past',
};

interface GuestStayFocusProps {
  stay: GuestFocusStay;
}

/**
 * The one highlighted block of the guest's page (SR-04b): the stay that matters now (the one in progress, the next one, or the
 * last that ended), where and when, how it stands, and the way to its booking, where what to do about it lives.
 */
export function GuestStayFocus({ stay }: GuestStayFocusProps) {
  const { t, i18n } = useTranslation();
  const { booking, phase } = stay;
  const nights = bookingNights(booking);
  const title = [booking.propertyName, stayRangeText(booking, i18n.language, todayInRome())].filter(Boolean).join(' · ');
  const details = [nights > 0 ? t('booking.list.nights', { count: nights }) : '', t('booking.list.guestCount', { count: booking.numberOfGuests })]
    .filter(Boolean)
    .join(' · ');

  return (
    <FocusBlock
      data-testid="guest-stay-focus"
      data-phase={phase}
      kicker={t(KICKER[phase])}
      title={title}
      body={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusBadge kind="booking" status={booking.status} />
          <span>{details}</span>
        </span>
      }
      primary={{ label: t('guests.detailPage.focus.open'), href: `${BOOKINGS_PATH}/${booking.id}`, testId: 'guest-stay-open-booking' }}
    />
  );
}
