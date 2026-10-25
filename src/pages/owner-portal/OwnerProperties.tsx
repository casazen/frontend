import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Building2, Calendar, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/shared/error-state';
import { SkeletonCard, SkeletonLine } from '@/components/ui/skeleton';
import { useOwnerProperties } from '@/queries/ownerPortal';
import { formatCurrency } from '@/lib/utils';
import { formatStayDate } from '@/lib/stay-dates';

/**
 * Owner portal property detail (ADR-011-R8): property details with occupancy and recent bookings.
 * Guest data is masked per ADR-011-R3: only dates, channel, amounts visible.
 */
export function OwnerProperties() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { propertyId } = useParams<{ propertyId: string }>();
  const { data: properties, isLoading, error } = useOwnerProperties();

  const property = properties?.find((p) => p.propertyId === propertyId);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl p-6 space-y-6">
        <SkeletonLine className="h-8 w-64" />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <ErrorState
          title={t('ownerPortal.properties.error')}
          message={t('ownerPortal.properties.errorMessage')}
        />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <ErrorState
          title={t('ownerPortal.properties.notFound')}
          message={t('ownerPortal.properties.notFoundMessage')}
        />
        <Button
          variant="outline"
          onClick={() => navigate('/portale-proprietari')}
          className="mt-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('ownerPortal.properties.backToDashboard')}
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/portale-proprietari')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-[#1f3a3d] flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            {property.propertyName}
          </h1>
          <p className="text-muted-foreground mt-1">{property.address}</p>
        </div>
      </div>

      {/* Property summary */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ownerPortal.properties.totalRevenue')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(property.totalRevenue, 'EUR')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ownerPortal.properties.totalBookings')}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{property.totalBookings}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ownerPortal.properties.occupancyRate')}</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{property.occupancyRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent bookings */}
      <Card>
        <CardHeader>
          <CardTitle>{t('ownerPortal.properties.recentBookings')}</CardTitle>
          <CardDescription>{t('ownerPortal.properties.recentBookingsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {property.recentBookings.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">{t('ownerPortal.properties.noBookings')}</p>
          ) : (
            <div className="space-y-4">
              {property.recentBookings.map((booking) => (
                <div
                  key={booking.bookingId}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {formatStayDate(booking.checkInDate)} - {formatStayDate(booking.checkOutDate)}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {t('ownerPortal.properties.channel')}: {booking.channel}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrency(booking.totalAmount, 'EUR')}</div>
                    <div className="text-sm text-muted-foreground">{t(`bookingStatus.${booking.status}`)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
