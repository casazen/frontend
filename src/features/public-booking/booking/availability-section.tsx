import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { StayCalendar } from '@/features/public-site/stay/stay-calendar';
import { useBooking } from '@/features/public-booking/booking/booking-context';
import '@/features/public-booking/booking/booking.css';
import '@/features/public-booking/property-page.css';

/**
 * «Disponibilità» (DB-04b): the calendar of the home for the next 12 months, with the price of every free night and the taken ones
 * struck through. Choosing the arrival and the departure here is the same as choosing them in the card: the stay is the one in the
 * address, so the card, the bar and the rules of cancellation follow. The minimum stay and the weekend are said from what the home
 * declares, never guessed.
 */
export function AvailabilitySection() {
  const { t } = useTranslation();
  const { stay, setStay, calendar, property } = useBooking();
  const minNights = typeof property.minNights === 'number' && property.minNights > 1 ? property.minNights : null;
  const weekend = (property.weekendSurchargePercent ?? 0) > 0;
  const lead = [
    minNights ? t('propertyBooking.availability.minNights', { count: minNights }) : null,
    weekend ? t('propertyBooking.availability.weekend') : t('propertyBooking.availability.prices'),
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section id="disponibilita" aria-labelledby="property-availability-title" className="scroll-mt-20 space-y-5" data-testid="property-availability">
      <div>
        <p className="pp-eyebrow">{t('propertyBooking.availability.eyebrow')}</p>
        <h2 id="property-availability-title" className="public-display text-2xl font-semibold">
          {t('propertyBooking.availability.title')}
        </h2>
        <p className="mt-2 max-w-[60ch] text-[var(--cz-public-muted)]">{lead}</p>
      </div>
      <div className="pp-cal">
        <StayCalendar value={{ checkIn: stay.checkIn, checkOut: stay.checkOut }} onChange={setStay} data={calendar} />
      </div>
      <p className="pp-cal__note">
        <Info aria-hidden />
        <span>{t('propertyBooking.availability.source')}</span>
      </p>
    </section>
  );
}
