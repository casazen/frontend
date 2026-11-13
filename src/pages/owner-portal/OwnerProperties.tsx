import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Building2, Calendar, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/shared/error-state';
import { SkeletonCard, SkeletonLine } from '@/components/ui/skeleton';
import { PortalReadProblem, TOUCH } from '@/features/owner-portal/portal-parts';
import { ownerPortalPaths } from '@/features/owner-portal/paths';
import { useOwnerProperties } from '@/queries/ownerPortal';
import { formatStayDate, parseStayDate } from '@/lib/stay-dates';

/**
 * Owner portal property detail (ADR-011-R8, E07/F07/US01/T03): property details with the number of its bookings and the recent ones. NO occupancy is drawn: the Home's service that works it
 * out answers nothing for an owner (the field is the placeholder 0), and a 0 in the place of a figure that is missing says what is not true (see `OwnerDashboard`).
 * Guest data is masked per ADR-011-R3: only dates, channel and state of a booking are visible. NO amount is drawn: the answer of the server has no currency (a booking can be in francs) and
 * its sums are the whole price the guests paid, not the share of the owner, so a «€» next to them would say what is not true. From here the owner goes to the calendar of the property
 * and to the inbox about it; the page reads the list of the owner's own properties and finds the property in it, so an id that is not one of them is «not found»
 * (never the data of somebody else), and a list that could not be read is an error with a retry, never «not found».
 */
export function OwnerProperties() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { propertyId } = useParams<{ propertyId: string }>();
  const properties = useOwnerProperties();

  const property = properties.data?.find((p) => p.propertyId === propertyId);

  if (properties.isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonLine className="h-8 w-64" />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (properties.isError) {
    return (
      <PortalReadProblem
        error={properties.error}
        failedTitle={t('ownerPortal.properties.error')}
        onRetry={() => void properties.refetch()}
        testId="owner-property-error"
      />
    );
  }

  if (!property) {
    return (
      <div className="space-y-4">
        <ErrorState title={t('ownerPortal.properties.notFound')} error={undefined} testId="owner-property-not-found" />
        <Button asChild variant="outline" className={TOUCH}>
          <Link to={ownerPortalPaths.home}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            {t('ownerPortal.properties.backToDashboard')}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button asChild variant="ghost" className={`${TOUCH} -ml-3`}>
          <Link to={ownerPortalPaths.home}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            {t('ownerPortal.properties.backToDashboard')}
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="flex min-w-0 items-start gap-2 break-words text-2xl font-bold text-[#1f3a3d] sm:text-3xl">
            <Building2 aria-hidden="true" className="mt-1 h-7 w-7 shrink-0" />
            <span className="min-w-0">{property.propertyName}</span>
          </h1>
          <p className="mt-1 break-words text-muted-foreground">{property.address}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className={TOUCH}>
            <Link to={ownerPortalPaths.calendar(property.propertyId)} data-testid="owner-property-calendar">
              <Calendar aria-hidden="true" className="h-4 w-4" />
              {t('ownerPortal.properties.openCalendar')}
            </Link>
          </Button>
          <Button asChild variant="outline" className={TOUCH}>
            <Link to={`${ownerPortalPaths.messages}?topic=property&propertyId=${encodeURIComponent(property.propertyId)}`} data-testid="owner-property-message">
              <MessageSquare aria-hidden="true" className="h-4 w-4" />
              {t('ownerPortal.properties.writeToAgency')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Property summary */}
      <h2 className="sr-only">{t('ownerPortal.properties.summaryTitle')}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ownerPortal.properties.totalBookings')}</CardTitle>
            <Calendar aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{property.totalBookings}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent bookings: dates, channel and state only, never a guest and never an amount (the answer has no currency and no share of the owner) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t('ownerPortal.properties.recentBookings')}</CardTitle>
          <CardDescription>{t('ownerPortal.properties.recentBookingsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {property.recentBookings.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{t('ownerPortal.properties.noBookings')}</p>
          ) : (
            <ul className="space-y-4" data-testid="owner-recent-bookings">
              {property.recentBookings.map((booking) => (
                <li key={booking.bookingId} className="flex min-w-0 flex-col gap-2 border-b pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {/* The answer writes a booking day as an instant (the stored UTC midnight of the day, `…T00:00:00Z`): the day is read as written, never as an instant in the browser time zone. */}
                      <span className="font-medium">
                        {formatStayDate(parseStayDate(booking.checkInDate), locale)} - {formatStayDate(parseStayDate(booking.checkOutDate), locale)}
                      </span>
                    </div>
                    <div className="mt-1 break-words text-sm text-muted-foreground">
                      {t('ownerPortal.properties.channel')}: {booking.channel}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground sm:text-right">{t(`bookingStatus.${booking.status}`)}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
