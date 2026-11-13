import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { isAlloggiatiNotDue } from '@/features/alloggiati/alloggiati-status.utils';
import { ComplianceDrawerButton } from '@/features/compliance/compliance-drawer/compliance-drawer-button';
import { useComplianceDrawerAvailable } from '@/features/compliance/compliance-drawer/use-compliance-drawer';
import { useAlloggiatiStatus } from '@/queries/use-alloggiati';
import type { Booking } from '@/types';

interface BookingComplianceSectionProps {
  booking: Pick<Booking, 'id' | 'propertyId'>;
}

/**
 * «Cassetto Compliance» of a booking (CHK-15, E03/F05/US02): under the Alloggiati Web of the stay, the action that takes the host to the
 * connected area to read the outcome of its communication, with the guide of what to check there. It says nothing about the outcome and offers no
 * way to record one: the result stays in the connected area. Not on the page when the connector is off or the user cannot read bookings.
 *
 * Whether the stay owes a communication is what the Alloggiati panel above it says, from the same status (the same query, so one request for both):
 * a no-show (`NotDue`: the guests never came) has none to check, so the section is not offered for it, as for no one else's reader of that state.
 * Until the status is known the section waits, so it does not appear and go.
 */
export function BookingComplianceSection({ booking }: BookingComplianceSectionProps) {
  const { t } = useTranslation();
  const available = useComplianceDrawerAvailable();
  const { data: status, isLoading } = useAlloggiatiStatus(booking.id, available);
  if (!available || isLoading || (status !== undefined && isAlloggiatiNotDue(status.status))) return null;

  return (
    <PlainSection title={t('compliance.drawer.section.title')} data-testid="booking-compliance-section">
      <p className="text-sm text-foreground/70">{t('compliance.drawer.section.body')}</p>
      <ComplianceDrawerButton target={{ topic: 'Alloggiati', propertyId: booking.propertyId, bookingId: booking.id }} testId="booking-compliance-drawer-trigger" />
    </PlainSection>
  );
}
