import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { ComplianceDrawerButton } from '@/features/compliance/compliance-drawer/compliance-drawer-button';
import { useComplianceDrawerAvailable } from '@/features/compliance/compliance-drawer/use-compliance-drawer';
import type { Booking } from '@/types';

/** A stay that was never confirmed, or was cancelled, has no communication to check: the section is for the others. */
const WITHOUT_STAY: readonly Booking['status'][] = ['Pending', 'Cancelled'];

interface BookingComplianceSectionProps {
  booking: Pick<Booking, 'id' | 'propertyId' | 'status'>;
}

/**
 * «Cassetto Compliance» of a booking (CHK-15, E03/F05/US02): under the Alloggiati Web of the stay, the action that takes the host to the
 * connected area to read the outcome of its communication, with the guide of what to check there. It says nothing about the outcome and offers no
 * way to record one: the result stays in the connected area. Not on the page when the connector is off or the user cannot read bookings.
 */
export function BookingComplianceSection({ booking }: BookingComplianceSectionProps) {
  const { t } = useTranslation();
  const available = useComplianceDrawerAvailable();
  if (!available || WITHOUT_STAY.includes(booking.status)) return null;

  return (
    <PlainSection title={t('compliance.drawer.section.title')} data-testid="booking-compliance-section">
      <p className="text-sm text-foreground/70">{t('compliance.drawer.section.body')}</p>
      <ComplianceDrawerButton target={{ topic: 'Alloggiati', propertyId: booking.propertyId, bookingId: booking.id }} testId="booking-compliance-drawer-trigger" />
    </PlainSection>
  );
}
