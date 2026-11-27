import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Building2, CalendarDays, ReceiptText } from 'lucide-react';
import { FocusBlock } from '@/components/shared/calm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonCard } from '@/components/ui/skeleton';
import { currentData } from '@/features/owner-portal/owner-portal-model';
import { periodLabel, sortedStatements } from '@/features/owner-portal/owner-statement-model';
import { PortalPageHeading, PortalReadProblem } from '@/features/owner-portal/portal-parts';
import { ownerPortalPaths } from '@/features/owner-portal/paths';
import { formatStayDate, romeDateOf } from '@/lib/stay-dates';
import { useOwnerProperties, useOwnerStatements } from '@/queries/ownerPortal';

const PUBLISHED_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

/**
 * The one thing an owner comes for (UX round 2026-11): the latest statement the agency published, with the way to open it. Nothing
 * while the list loads, fails or is empty: the page has its properties anyway, and the accounting page says the rest.
 */
function LatestStatementFocus() {
  const { t, i18n } = useTranslation();
  const statements = currentData(useOwnerStatements());
  const latest = statements ? sortedStatements(statements).find((statement) => !statement.superseded) : undefined;
  if (!latest) return null;

  const language = i18n.language;
  const period = periodLabel(latest.year, latest.month, language);
  const published = t('ownerPortal.accounting.publishedOn', { date: formatStayDate(romeDateOf(latest.publishedAt), language, PUBLISHED_DATE) });
  return (
    <FocusBlock
      icon={ReceiptText}
      title={t('ownerPortal.accounting.statementTitle', { period })}
      body={latest.agencyName ? `${published} · ${latest.agencyName}` : published}
      primary={{ label: t('ownerPortal.accounting.open'), href: ownerPortalPaths.statement(latest.statementId), testId: 'owner-home-latest-statement' }}
      data-testid="owner-home-focus"
    />
  );
}

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

  return (
    <div className="space-y-6">
      <PortalPageHeading icon={Building2} title={t('ownerPortal.dashboard.title')} description={t('ownerPortal.dashboard.description')} />

      <LatestStatementFocus />

      {/* Properties list */}
      <section className="space-y-4" aria-labelledby="owner-properties-title">
        <h2 id="owner-properties-title" className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
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
                <Card className="h-full overflow-hidden">
                  <CardHeader>
                    <CardTitle className="flex min-w-0 items-center gap-3 text-xl">
                      <Building2 aria-hidden="true" className="size-9 shrink-0 rounded-lg bg-muted p-2 text-foreground" />
                      <Link
                        to={ownerPortalPaths.property(property.propertyId)}
                        className="inline-flex min-h-11 min-w-0 items-center gap-1 break-words hover:underline"
                      >
                        {property.propertyName}<ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
                      </Link>
                    </CardTitle>
                    <CardDescription className="break-words">{property.address}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-2 gap-4 border-t pt-4 text-sm">
                      <div>
                        <dt className="text-muted-foreground">{t('ownerPortal.dashboard.bookings')}</dt>
                        <dd className="mt-1 text-xl font-semibold tabular-nums">{property.totalBookings}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{t('ownerPortal.dashboard.recentBookings')}</dt>
                        <dd className="mt-1 text-xl font-semibold tabular-nums">{property.recentBookings.length}</dd>
                      </div>
                    </dl>
                    <Link to={ownerPortalPaths.calendar(property.propertyId)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-muted px-3 text-sm font-semibold text-foreground hover:underline">
                      <CalendarDays aria-hidden="true" className="size-4" />
                      {t('ownerPortal.shell.nav.calendar')}
                      <span className="sr-only"> · {property.propertyName}</span>
                    </Link>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* The numbers of the period are not available for an owner yet: said, never a zero in their place */}
      {list && list.length > 0 && !properties.isError && (
        <details className="text-sm text-muted-foreground" data-testid="owner-numbers-unavailable">
          <summary className="w-fit cursor-pointer rounded py-3 font-medium focus-visible:ring-2">
            {t('ownerPortal.dashboard.numbersUnavailable.title')}
          </summary>
          <p className="max-w-prose pb-3">{t('ownerPortal.dashboard.numbersUnavailable.description')}</p>
        </details>
      )}
    </div>
  );
}
