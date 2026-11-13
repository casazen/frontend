import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonCard } from '@/components/ui/skeleton';
import { PortalPageHeading, PortalReadProblem } from '@/features/owner-portal/portal-parts';
import { ownerPortalPaths } from '@/features/owner-portal/paths';
import { useOwnerProperties } from '@/queries/ownerPortal';

/**
 * Owner portal overview (ADR-011-R8, E07/F07/US01/T03): the list of the owner's properties, each one a link to its page, with the number of its bookings.
 *
 * It draws NO number of occupancy, revenue, ADR or RevPAR and no trend, and no amount of money: the Home's service (`IHostDashboardService`) that works them out still reads under the
 * tenant filter of the request and answers nothing for an owner (S101 follow-up), so the overview, the trend and the occupancy of a property are empty or zero for every owner, and the
 * sums of a property are the whole price the guests paid, with no currency and no share of the owner. A zero in the place of a figure that is missing says what is not true, so the page
 * says in words that the numbers are not available yet (`useOwnerOverview` and `useOwnerTrend` stay in the queries for the page that draws them once the service answers).
 * A property is a link (a card that only listens to the pointer would be out of reach of the keyboard), and every part that cannot be read says so: it never reads as «nothing to show».
 */
export function OwnerDashboard() {
  const { t } = useTranslation();
  const properties = useOwnerProperties();
  const list = properties.data;
  const hasNoProperties = list !== undefined && list.length === 0;

  return (
    <div className="space-y-6">
      <PortalPageHeading title={t('ownerPortal.dashboard.title')} description={t('ownerPortal.dashboard.description')} />

      {/* The numbers of the period are not available for an owner yet: said, never a zero in their place */}
      {hasNoProperties ? null : (
        <Alert variant="info" title={t('ownerPortal.dashboard.numbersUnavailable.title')} data-testid="owner-numbers-unavailable">
          {t('ownerPortal.dashboard.numbersUnavailable.description')}
        </Alert>
      )}

      {/* Properties list */}
      <section className="space-y-4" aria-labelledby="owner-properties-title">
        <h2 id="owner-properties-title" className="text-xl font-semibold text-[#1f3a3d] sm:text-2xl">
          {t('ownerPortal.dashboard.yourProperties')}
        </h2>
        {properties.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : properties.isError ? (
          <PortalReadProblem
            error={properties.error}
            failedTitle={t('ownerPortal.dashboard.error')}
            onRetry={() => void properties.refetch()}
            testId="owner-properties-error"
          />
        ) : !list || list.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">{t('ownerPortal.dashboard.noProperties')}</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2" data-testid="owner-properties">
            {list.map((property) => (
              <li key={property.propertyId} className="min-w-0">
                <Card className="relative h-full transition-shadow focus-within:ring-2 focus-within:ring-ring hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="flex min-w-0 items-start gap-2 text-xl">
                      <Building2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#1f3a3d]" />
                      <Link
                        to={ownerPortalPaths.property(property.propertyId)}
                        className="min-w-0 break-words after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                      >
                        {property.propertyName}
                      </Link>
                    </CardTitle>
                    <CardDescription className="break-words">{property.address}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <dt className="text-muted-foreground">{t('ownerPortal.dashboard.bookings')}</dt>
                        <dd className="font-semibold">{property.totalBookings}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{t('ownerPortal.dashboard.recentBookings')}</dt>
                        <dd className="font-semibold">{property.recentBookings.length}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
