import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BedDouble, CalendarCheck, CalendarClock, CalendarDays, ClipboardList, LogIn, Plus, Wrench } from 'lucide-react';
import { Figure, Figures, InfoCard } from '@/components/shared/calm';
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

  return (
    <div className="@container space-y-4">
      <InfoCard
        icon={CalendarDays}
        title={t('property.bookings.title')}
        action={
          canReadBookings ? { label: t('property.detail.allBookings'), href: propertyBookingsPath(property.id), testId: 'property-bookings-link' } : undefined
        }
      >
        <Figures className="grid-cols-2 @2xl:grid-cols-4">
          <Figure icon={CalendarCheck} label={t('property.bookings.total')} size="lg">
            {summary.totalBookings}
          </Figure>
          <Figure icon={LogIn} label={t('property.bookings.upcoming')} size="lg">
            {summary.upcomingBookings}
          </Figure>
          <Figure icon={BedDouble} label={t('property.bookings.active')} size="lg">
            {summary.activeBookings}
          </Figure>
          <Figure icon={CalendarClock} label={t('property.bookings.nextCheckIn')} size="lg">
            {summary.nextCheckIn ? formatStayDate(stayDateOf(summary.nextCheckIn), i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
          </Figure>
        </Figures>
        {canCreateBooking ? (
          <div>
            <Button asChild variant="outline" size="sm">
              <Link to={propertyNewBookingPath(property.id)} data-testid="property-new-booking">
                <Plus aria-hidden="true" className="size-4" />
                {t('property.detail.newBooking')}
              </Link>
            </Button>
          </div>
        ) : null}
      </InfoCard>

      <div className="grid min-w-0 gap-4 @4xl:grid-cols-2 @4xl:items-start">
        {routinesOn && canWrite ? <PropertyCleaningCard propertyId={property.id} /> : null}

        <ServiceRequestsCard
          icon={ClipboardList}
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
    </div>
  );
}
