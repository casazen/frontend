import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Wrench } from 'lucide-react';
import { PlainSection, StatStrip, StatTile } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { stayDateOf } from '@/features/bookings/lib/booking-price';
import { ServiceRequestsCard } from '@/features/service-requests/components/service-requests-card';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { formatStayDate } from '@/lib/stay-dates';
import { useServiceRequests } from '@/queries/use-service-requests';
import type { PropertyDetailDto } from '@/types';
import { propertyBookingsPath, propertyNewBookingPath, propertyServiceRequestPath } from '../properties-paths';
import { PropertyCleaningCard } from './property-cleaning-card';

interface PropertyActivityTabProps {
  property: PropertyDetailDto;
  canReadBookings: boolean;
  canCreateBooking: boolean;
  canWrite: boolean;
}

export function PropertyActivityTab({ property, canReadBookings, canCreateBooking, canWrite }: PropertyActivityTabProps) {
  const { t, i18n } = useTranslation();
  const serviceRequests = useServiceRequests({ propertyId: property.id, pageSize: 50 });
  const summary = property.bookingsSummary;
  const routinesOn = useFeatureFlags().flags.routines;

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

      {routinesOn && canWrite ? <PropertyCleaningCard propertyId={property.id} /> : null}

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
