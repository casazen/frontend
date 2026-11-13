import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/shared/error-state';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { SkeletonCard } from '@/components/ui/skeleton';
import { FIXED_PRESETS } from '@/features/reports/overview/overview-model';
import { PerformanceTiles } from '@/features/reports/overview/performance-tiles';
import { TrendChart } from '@/features/reports/overview/trend-chart';
import { presetPeriod } from '@/features/reports/report-period';
import { PortalPageHeading, PortalReadProblem } from '@/features/owner-portal/portal-parts';
import { ownerPortalPaths } from '@/features/owner-portal/paths';
import { formatStayDate, todayInRome } from '@/lib/stay-dates';
import { useOwnerOverview, useOwnerProperties, useOwnerTrend } from '@/queries/ownerPortal';
import type { OwnerPortalReportQuery } from '@/types';

const SHORT_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** The periods the owner picks from: whole months and years, no days to type. */
type FixedPreset = (typeof FIXED_PRESETS)[number];

/**
 * Owner portal overview (ADR-011-R8, E07/F07/US01/T03): the owner's properties on the Home's numbers (NF-96) and the list of the properties.
 * Occupancy, revenue, ADR and RevPAR of the period come with the same days one year earlier and the trend, all from
 * `GET /api/owner-portal/overview` and `/trend`, with the money weighted by the share the owner holds: the browser sums and
 * averages nothing. Guest data is masked per ADR-011-R3 (there is none in these numbers). A property is a link (a card that only listens to the pointer would
 * be out of reach of the keyboard), and every part that cannot be read says so: it never reads as «nothing to show».
 */
export function OwnerDashboard() {
  const { t, i18n } = useTranslation();
  const [preset, setPreset] = useState<FixedPreset>('thisYear');
  const properties = useOwnerProperties();
  const list = properties.data;

  // The owner reads its own numbers against last year, all its properties together.
  const query: OwnerPortalReportQuery = { ...presetPeriod(preset, todayInRome()), groupBy: 'none', compare: true };
  const overview = useOwnerOverview(query);
  const trend = useOwnerTrend(query);
  const hasNoProperties = list !== undefined && list.length === 0;

  return (
    <div className="space-y-6">
      <PortalPageHeading title={t('ownerPortal.dashboard.title')} description={t('ownerPortal.dashboard.description')} />

      {/* The numbers of the period: the server's, with the year before */}
      {hasNoProperties ? null : (
        <div className="space-y-6" data-testid="owner-overview">
          <Field label={t('ownerPortal.dashboard.period')} className="w-full sm:w-56">
            <Select value={preset} className="min-h-11" onChange={(event) => setPreset(event.target.value as FixedPreset)} data-testid="owner-period">
              {FIXED_PRESETS.map((id) => (
                <option key={id} value={id}>
                  {t(`reports.preset.${id}`)}
                </option>
              ))}
            </Select>
          </Field>

          {overview.data ? (
            <div className="space-y-3" aria-busy={overview.isPlaceholderData}>
              <PerformanceTiles
                row={overview.data.total}
                currency={overview.data.currency}
                compared={overview.data.comparePeriod !== null}
                names={{
                  occupancy: t('ownerPortal.dashboard.occupancy'),
                  revenue: t('ownerPortal.dashboard.revenue'),
                  adr: t('ownerPortal.dashboard.adr'),
                  revPar: t('ownerPortal.dashboard.revPar'),
                }}
                label={t('ownerPortal.dashboard.tilesLabel')}
                testId="owner-tiles"
              />
              {overview.data.comparePeriod ? (
                <p className="text-sm text-foreground/70" data-testid="owner-compare-period">
                  {t('ownerPortal.dashboard.previousYear', {
                    from: formatStayDate(overview.data.comparePeriod.from, i18n.language, SHORT_DATE),
                    to: formatStayDate(overview.data.comparePeriod.to, i18n.language, SHORT_DATE),
                  })}
                </p>
              ) : null}
              <p className="text-sm text-foreground/70">{t('ownerPortal.dashboard.share')}</p>
            </div>
          ) : overview.isError ? (
            <ErrorState title={t('ownerPortal.dashboard.overviewError')} error={overview.error} onRetry={() => void overview.refetch()} testId="owner-overview-error" />
          ) : (
            <SkeletonCard lines={2} />
          )}

          {trend.data ? (
            <TrendChart
              unit={trend.data.unit}
              buckets={trend.data.buckets}
              series={trend.data.series}
              currency={trend.data.currency}
              compared={trend.data.comparePeriod !== null}
              groupBy={trend.data.groupBy}
              title={t('ownerPortal.dashboard.trendTitle')}
              titleAs="h2"
              testId="owner-trend"
            />
          ) : trend.isError ? (
            <ErrorState title={t('ownerPortal.dashboard.trendError')} error={trend.error} onRetry={() => void trend.refetch()} testId="owner-trend-error" />
          ) : (
            <SkeletonCard lines={4} />
          )}
        </div>
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
