import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Wrench } from 'lucide-react';
import { PlainSection, StatStrip, StatTile } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { stayDateOf } from '@/features/bookings/lib/booking-price';
import { ServiceRequestsCard } from '@/features/service-requests/components/service-requests-card';
import { formatStayDate } from '@/lib/stay-dates';
import { useServiceRequests } from '@/queries/use-service-requests';
import type { PropertyDetailDto } from '@/types';
import { propertyBookingsPath, propertyNewBookingPath, propertyServiceRequestPath } from '../properties-paths';

interface PropertyActivityTabProps {
  property: PropertyDetailDto;
  /** `booking.read`: the bookings, the marketplace and the calendar are pages of the bookings. */
  canReadBookings: boolean;
  /** `booking.write`: a booking for this property can be started from here. */
  canCreateBooking: boolean;
  /** `property.write`: the requests to the suppliers can be paid and asked again (the API asks for the same permission). */
  canWrite: boolean;
}

/**
 * The tab Prenotazioni e interventi (SR-07d): what is linked to the property, the bookings in four numbers and the requests
 * to the suppliers, each with its stay. Both were on the first tab of the old page; here they have their own.
 */
export function PropertyActivityTab({ property, canReadBookings, canCreateBooking, canWrite }: PropertyActivityTabProps) {
  const { t, i18n } = useTranslation();
  // The property's short-rent requests, each linked to its stay (D2): read only when this tab is open.
  const serviceRequests = useServiceRequests({ propertyId: property.id, pageSize: 50 });
  const summary = property.bookingsSummary;

  const bookings = (
    <>
      <StatStrip label={t('property.bookings.title')}>
        <StatTile label={t('property.bookings.total')} value={summary.totalBookings} />
        <StatTile label={t('property.bookings.upcoming')} value={summary.upcomingBookings} />
        <StatTile label={t('property.bookings.active')} value={summary.activeBookings} />
        <StatTile
          label={t('property.bookings.nextCheckIn')}
          value={summary.nextCheckIn ? formatStayDate(stayDateOf(summary.nextCheckIn), i18n.language) : '—'}
        />
      </StatStrip>
      {canCreateBooking ? (
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link to={propertyNewBookingPath(property.id)} data-testid="property-new-booking">
            <Plus aria-hidden="true" className="size-4" />
            {t('property.detail.newBooking')}
          </Link>
        </Button>
      ) : null}
    </>
  );

  return (
    <div className="space-y-8">
      {canReadBookings ? (
        <PlainSection
          title={t('property.bookings.title')}
          actionLabel={t('property.detail.allBookings')}
          href={propertyBookingsPath(property.id)}
          actionTestId="property-bookings-link"
        >
          {bookings}
        </PlainSection>
      ) : (
        <PlainSection title={t('property.bookings.title')}>{bookings}</PlainSection>
      )}

      <ServiceRequestsCard
        plain
        query={serviceRequests}
        emptyText={t('serviceRequest.emptyForProperty')}
        showStay
        canManage={canWrite}
        testId="property-service-requests"
        action={
          canReadBookings ? (
            <Button asChild variant="outline" size="sm">
              <Link to={propertyServiceRequestPath(property.id)} data-testid="property-request-service-btn">
                <Wrench aria-hidden="true" className="size-4" />
                {t('property.list.actions.requestService')}
              </Link>
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
