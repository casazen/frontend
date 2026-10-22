import { useTranslation } from 'react-i18next';
import { CalendarCheck, Mail, Wallet } from 'lucide-react';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { formatStayDate } from '@/lib/stay-dates';
import { useProperties } from '@/queries/use-properties';
import type { Booking } from '@/types';
import { activeLink, portalName, splitGuestName, type NewBookingValues } from '../lib/new-booking-model';

const BOOKINGS_PATH = '/app/short-rent/bookings';

/**
 * "What happens now" after the booking was created: what the system does by itself (the nights are taken, the guest gets the
 * link of the online check-in) and what is still up to the host (no payment was recorded; for a portal's reservation, the
 * portal collects). Only things that are true today.
 */
export function NewBookingDone({ booking, values }: { booking: Booking; values: NewBookingValues }) {
  const { t, i18n } = useTranslation();
  const properties = useProperties({ mode: 'short' });
  const propertyName =
    (Array.isArray(properties.data) ? properties.data : []).find((property) => property.id === values.propertyId)?.name ??
    booking.propertyName ??
    '';

  const day = (date: string) => formatStayDate(date, i18n.language, { day: 'numeric', month: 'long' });
  const from = day(values.checkInDate);
  const to = day(values.checkOutDate);
  const { firstName } = splitGuestName(values.guest.name);
  const fullName = values.guest.name.trim().replace(/\s+/g, ' ') || t('booking.create.done.guestFallback');
  const link = activeLink(values);

  return (
    <WizardDone
      title={t('booking.create.done.title', { name: fullName })}
      description={t('booking.create.done.description', { property: propertyName, from, to })}
      whatNext={[
        { text: t('booking.create.done.calendar', { from, to }), icon: CalendarCheck },
        { text: t('booking.create.done.checkin', { name: firstName || t('booking.create.done.guestFallback') }), icon: Mail },
        {
          text: link ? t('booking.create.done.paymentPortal', { portal: portalName(link.channel, t) }) : t('booking.create.done.payment'),
          icon: Wallet,
        },
      ]}
      primary={{ label: t('booking.create.done.open'), to: `${BOOKINGS_PATH}/${booking.id}` }}
      secondary={{ label: t('booking.create.done.toList'), to: BOOKINGS_PATH }}
    />
  );
}
