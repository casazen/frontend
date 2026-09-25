import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Calendar, CheckCircle, AlertCircle, CreditCard, LogIn, LogOut, TrendingUp, Wifi } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useOtaIntegrations } from '@/queries/use-ota';
import { useDashboardKpis } from '@/queries/use-dashboard';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getProblemMessage } from '@/lib/api-errors';
import { getBookingStatusLabel, getOtaConnectionStatusLabel } from '@/lib/i18n-labels';
import { formatStayDate } from '@/lib/stay-dates';
import { BOOKING_STATUS_VARIANTS } from '@/features/bookings/schemas/booking.schema';
import { ComplianceSummaryWidget } from '@/features/compliance/compliance-summary-widget';
import type { OtaIntegration, OtaPlatform } from '@/types';
import type { DashboardKpis, DashboardPeriodSelection, DashboardStay, DashboardStayList } from '@/types/dashboard.types';
import { StatsCard } from './components/stats-card';
import { DashboardPeriodSelect } from './components/dashboard-period-select';
import { DashboardIcalWidget } from './components/dashboard-ical-widget';

const PLATFORM_LABELS: Record<OtaPlatform, string> = {
  AIRBNB: 'Airbnb',
  BOOKING_COM: 'Booking.com',
  EXPEDIA: 'Expedia',
  VRBO: 'VRBO',
  TRIPADVISOR: 'TripAdvisor',
  AGODA: 'Agoda',
};

const SHORT_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };

function getOtaConnectionStatus(integration: OtaIntegration): 'connected' | 'warning' | 'disconnected' {
  if (!integration.isActive) return 'disconnected';
  if (integration.lastSyncStatus === 'FAILED') return 'warning';
  return 'connected';
}

function formatMoney(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}

function formatPercent(rate: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(rate);
}

function bookingPath(bookingId: string): string {
  return `/app/short-rent/bookings/${bookingId}`;
}

function normalizeDashboardKpis(value: unknown): DashboardKpis | null {
  if (typeof value === 'object' && value !== null && 'data' in value) {
    return normalizeDashboardKpis((value as { data?: unknown }).data);
  }
  return typeof value === 'object' && value !== null ? (value as DashboardKpis) : null;
}

/**
 * Host dashboard (PC-16, A2-29): KPIs of the chosen period computed by the server (occupancy on nights, revenue of the
 * confirmed stays, today's arrivals and departures in Europe/Rome, upcoming check-ins), the iCal calendars in place of
 * the frozen OTA channels (D10), skeletons while loading and the API error when a request fails, never zeroes.
 */
export function DashboardPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<DashboardPeriodSelection>({ kind: 'Month' });
  const kpis = useDashboardKpis(period);
  const dashboardKpis = normalizeDashboardKpis(kpis.data);
  const canReadProperties = useWorkspace().hasPermission('short-rent', 'property.read');
  // OTA partner API in freeze (D10): no widget and no request while the flag is off.
  const otaEnabled = useFeatureFlags().flags.otaPartnerApi;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t('dashboard.title')}
          description={t('dashboard.description')}
          action={<DashboardPeriodSelect value={period} onChange={setPeriod} />}
        />

        <ComplianceSummaryWidget />

        {kpis.isLoading ? (
          <DashboardSkeleton />
        ) : kpis.isError && !kpis.data ? (
          <Card role="alert" data-testid="dashboard-error">
            <CardContent className="space-y-3 py-6 text-center">
              <p className="text-sm text-destructive">{getProblemMessage(kpis.error, t) ?? t('dashboard.loadError')}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void kpis.refetch()}>
                {t('dashboard.retry')}
              </Button>
            </CardContent>
          </Card>
        ) : dashboardKpis ? (
          <DashboardKpisView kpis={dashboardKpis} refreshing={kpis.isFetching} />
        ) : null}

        <div className={otaEnabled ? 'grid gap-4 md:grid-cols-2' : 'grid gap-4'}>
          {canReadProperties && <DashboardIcalWidget />}
          {otaEnabled && <OtaStatusCard />}
        </div>
      </div>
    </AppShell>
  );
}

function DashboardKpisView({ kpis, refreshing }: { kpis: DashboardKpis; refreshing: boolean }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { occupancy, revenue } = kpis;
  const from = formatStayDate(kpis.period.from, locale);
  const to = formatStayDate(kpis.period.to, locale);

  return (
    <div className="space-y-4" data-testid="dashboard-kpis" aria-busy={refreshing || undefined}>
      <p className="text-sm text-muted-foreground" data-testid="dashboard-period-range">
        {t('dashboard.period.range', { from, to })}
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title={t('dashboard.stats.occupancy.title')}
          value={occupancy.rate === null ? '—' : formatPercent(occupancy.rate, locale)}
          icon={TrendingUp}
          description={
            occupancy.closedNights > 0
              ? t('dashboard.stats.occupancy.descriptionWithClosed', {
                  occupied: occupancy.occupiedNights,
                  available: occupancy.availableNights,
                  closed: occupancy.closedNights,
                  count: kpis.propertyCount,
                })
              : t('dashboard.stats.occupancy.description', {
                  occupied: occupancy.occupiedNights,
                  available: occupancy.availableNights,
                  count: kpis.propertyCount,
                })
          }
          testId="dashboard-stat-occupancy"
        />
        <StatsCard
          title={t('dashboard.stats.revenue.title')}
          value={formatMoney(revenue.amount, revenue.currency, locale)}
          icon={CreditCard}
          description={t('dashboard.stats.revenue.description', { count: revenue.stayCount })}
          testId="dashboard-stat-revenue"
        />
        <StatsCard
          title={t('dashboard.stats.arrivalsToday.title')}
          value={String(kpis.arrivalsToday.count)}
          icon={LogIn}
          description={t('dashboard.stats.arrivalsToday.description', { date: formatStayDate(kpis.today, locale) })}
          testId="dashboard-stat-arrivals"
        />
        <StatsCard
          title={t('dashboard.stats.departuresToday.title')}
          value={String(kpis.departuresToday.count)}
          icon={LogOut}
          description={t('dashboard.stats.departuresToday.description', { date: formatStayDate(kpis.today, locale) })}
          testId="dashboard-stat-departures"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="dashboard-today">
          <CardHeader>
            <CardTitle>{t('dashboard.today.title')}</CardTitle>
            <CardDescription>{t('dashboard.today.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StayList
              title={t('dashboard.today.arrivals')}
              list={kpis.arrivalsToday}
              empty={t('dashboard.today.noArrivals')}
              testId="dashboard-arrivals"
            />
            <StayList
              title={t('dashboard.today.departures')}
              list={kpis.departuresToday}
              empty={t('dashboard.today.noDepartures')}
              testId="dashboard-departures"
            />
          </CardContent>
        </Card>

        <Card data-testid="dashboard-upcoming">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t('dashboard.upcoming.title')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.upcoming.description', { count: kpis.upcomingCheckIns.count })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StayList list={kpis.upcomingCheckIns} empty={t('dashboard.upcoming.empty')} testId="dashboard-upcoming-list" />
          </CardContent>
        </Card>
      </div>

      <RecentBookings bookings={kpis.recentBookings} />
    </div>
  );
}

interface StayListProps {
  title?: string;
  list: DashboardStayList;
  empty: string;
  testId: string;
}

function StayList({ title, list, empty, testId }: StayListProps) {
  const { t, i18n } = useTranslation();

  return (
    <section className="space-y-2" data-testid={testId}>
      {title && (
        <h3 className="flex items-center justify-between text-sm font-medium">
          {title}
          <Badge variant="outline" data-testid={`${testId}-count`}>
            {list.count}
          </Badge>
        </h3>
      )}
      {list.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {list.items.map((stay) => (
            <li key={stay.bookingId}>
              <Link
                to={bookingPath(stay.bookingId)}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
                data-testid={`${testId}-item`}
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{stay.guestName}</span>
                  <span className="text-muted-foreground"> · {stay.propertyName}</span>
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {formatStayDate(stay.checkInDate, i18n.language, SHORT_DATE)}–
                  {formatStayDate(stay.checkOutDate, i18n.language, SHORT_DATE)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {list.count > list.items.length && (
        <p className="px-2 text-xs text-muted-foreground">
          {t('dashboard.moreItems', { count: list.count - list.items.length })}
        </p>
      )}
    </section>
  );
}

function RecentBookings({ bookings }: { bookings: DashboardStay[] }) {
  const { t, i18n } = useTranslation();

  return (
    <Card data-testid="dashboard-recent-bookings">
      <CardHeader>
        <CardTitle>{t('dashboard.recentBookings.title')}</CardTitle>
        <CardDescription>{t('dashboard.recentBookings.description')}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {bookings.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t('dashboard.recentBookings.empty')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('dashboard.recentBookings.columns.guest')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('dashboard.recentBookings.columns.property')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('dashboard.recentBookings.columns.dates')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    {t('dashboard.recentBookings.columns.amount')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('dashboard.recentBookings.columns.status')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.bookingId} className="border-b last:border-0 transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      <Link to={bookingPath(b.bookingId)} className="hover:underline">
                        {b.guestName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{b.propertyName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatStayDate(b.checkInDate, i18n.language, SHORT_DATE)}–
                      {formatStayDate(b.checkOutDate, i18n.language, SHORT_DATE)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatMoney(b.totalPrice, 'EUR', i18n.language)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={BOOKING_STATUS_VARIANTS[b.status] ?? 'secondary'}>
                        {getBookingStatusLabel(b.status, t)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" data-testid="dashboard-loading" aria-busy="true">
      <Skeleton className="h-4 w-48" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
      <Skeleton className="h-56 w-full" />
    </div>
  );
}

/** OTA partner channels: only with the `otaPartnerApi` flag on (D10). */
function OtaStatusCard() {
  const { t } = useTranslation();
  const { data: otaIntegrations } = useOtaIntegrations();
  const otaList = Array.isArray(otaIntegrations) ? otaIntegrations : [];

  return (
    <Card data-testid="dashboard-ota-status">
      <CardHeader>
        <CardTitle>{t('dashboard.otaStatus.title')}</CardTitle>
        <CardDescription>{t('dashboard.otaStatus.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {otaList.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">{t('dashboard.otaStatus.empty')}</div>
        ) : (
          <div className="space-y-3">
            {otaList.map((integration) => {
              const status = getOtaConnectionStatus(integration);
              return (
                <div key={integration.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {status === 'connected' && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {status === 'warning' && <AlertCircle className="h-4 w-4 text-yellow-500" />}
                    {status === 'disconnected' && <Wifi className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-sm font-medium">
                      {PLATFORM_LABELS[integration.platform] ?? integration.platform}
                    </span>
                  </div>
                  <Badge
                    variant={status === 'connected' ? 'outline' : status === 'warning' ? 'secondary' : 'destructive'}
                  >
                    {getOtaConnectionStatusLabel(status, t)}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
