import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, FileText, TrendingUp, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/shared/error-state';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useOwnerProperties } from '@/queries/ownerPortal';
import { formatCurrency } from '@/lib/utils';

/**
 * Owner portal dashboard (ADR-011-R8): overview with properties list, occupancy and revenue.
 * Guest data is masked per ADR-011-R3.
 */
export function OwnerDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: properties, isLoading, error } = useOwnerProperties();

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl p-6 space-y-6">
        <h1 className="text-3xl font-bold text-[#1f3a3d]">{t('ownerPortal.dashboard.title')}</h1>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-7xl p-6">
        <ErrorState
          title={t('ownerPortal.dashboard.error')}
          message={t('ownerPortal.dashboard.errorMessage')}
        />
      </div>
    );
  }

  const totalRevenue = properties?.reduce((sum, p) => sum + p.totalRevenue, 0) ?? 0;
  const totalBookings = properties?.reduce((sum, p) => sum + p.totalBookings, 0) ?? 0;
  const avgOccupancy = properties && properties.length > 0
    ? properties.reduce((sum, p) => sum + p.occupancyRate, 0) / properties.length
    : 0;

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-[#1f3a3d]">{t('ownerPortal.dashboard.title')}</h1>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/portale-proprietari/rendiconti')}
          >
            <FileText className="mr-2 h-4 w-4" />
            {t('ownerPortal.dashboard.viewStatements')}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ownerPortal.dashboard.totalRevenue')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue, 'EUR')}</div>
            <p className="text-xs text-muted-foreground">{t('ownerPortal.dashboard.allProperties')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ownerPortal.dashboard.totalBookings')}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBookings}</div>
            <p className="text-xs text-muted-foreground">{t('ownerPortal.dashboard.allProperties')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ownerPortal.dashboard.avgOccupancy')}</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgOccupancy.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">{t('ownerPortal.dashboard.acrossProperties')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Properties list */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-[#1f3a3d]">{t('ownerPortal.dashboard.yourProperties')}</h2>
        {!properties || properties.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">{t('ownerPortal.dashboard.noProperties')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {properties.map((property) => (
              <Card
                key={property.propertyId}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => navigate(`/portale-proprietari/immobili/${property.propertyId}`)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-[#1f3a3d]" />
                    {property.propertyName}
                  </CardTitle>
                  <CardDescription>{property.address}</CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-muted-foreground">{t('ownerPortal.dashboard.revenue')}</dt>
                      <dd className="font-semibold">{formatCurrency(property.totalRevenue, 'EUR')}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t('ownerPortal.dashboard.bookings')}</dt>
                      <dd className="font-semibold">{property.totalBookings}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t('ownerPortal.dashboard.occupancy')}</dt>
                      <dd className="font-semibold">{property.occupancyRate.toFixed(1)}%</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t('ownerPortal.dashboard.recentBookings')}</dt>
                      <dd className="font-semibold">{property.recentBookings.length}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
