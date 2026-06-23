import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { StatsCard } from './components/stats-card';
import { Home, Calendar, CreditCard, TrendingUp, Wifi, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { useBookings } from '@/queries/use-bookings';
import { useProperties } from '@/queries/use-properties';
import { usePayments } from '@/queries/use-payments';
import { useOtaIntegrations } from '@/queries/use-ota';
import { getBookingStatusLabel, getOtaConnectionStatusLabel } from '@/lib/i18n-labels';
import type { OtaIntegration, OtaPlatform } from '@/types';

const PLATFORM_LABELS: Record<OtaPlatform, string> = {
  AIRBNB: 'Airbnb',
  BOOKING_COM: 'Booking.com',
  EXPEDIA: 'Expedia',
  VRBO: 'VRBO',
  TRIPADVISOR: 'TripAdvisor',
  AGODA: 'Agoda',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  Confirmed: 'default',
  Pending: 'secondary',
  CheckedIn: 'outline',
  CheckedOut: 'outline',
  Cancelled: 'destructive',
};

function formatDate(d: string, locale: string) {
  return new Date(d).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  });
}

function getOtaConnectionStatus(integration: OtaIntegration): 'connected' | 'warning' | 'disconnected' {
  if (!integration.isActive) return 'disconnected';
  if (integration.lastSyncStatus === 'FAILED') return 'warning';
  return 'connected';
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { data: bookings } = useBookings();
  const { data: properties } = useProperties();
  const { data: payments } = usePayments();
  const { data: otaIntegrations } = useOtaIntegrations();

  const totalRevenue = (payments ?? [])
    .filter((p) => p.status === 'Completed')
    .reduce((sum, p) => sum + p.amount, 0);

  const activeBookings = (bookings ?? []).filter(
    (b) => b.status === 'Confirmed' || b.status === 'CheckedIn',
  ).length;

  const totalProperties = (properties ?? []).length;

  const checkedIn = (bookings ?? []).filter((b) => b.status === 'CheckedIn').length;
  const occupancyRate =
    totalProperties > 0 ? Math.round((checkedIn / totalProperties) * 100) : 0;

  const recentBookings = [...(bookings ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title={t('dashboard.title')} description={t('dashboard.description')} />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title={t('dashboard.stats.totalRevenue.title')}
            value={`€${totalRevenue.toLocaleString()}`}
            icon={CreditCard}
            description={t('dashboard.stats.totalRevenue.description')}
          />
          <StatsCard
            title={t('dashboard.stats.activeBookings.title')}
            value={String(activeBookings)}
            icon={Calendar}
            description={t('dashboard.stats.activeBookings.description')}
          />
          <StatsCard
            title={t('dashboard.stats.totalProperties.title')}
            value={String(totalProperties)}
            icon={Home}
            description={t('dashboard.stats.totalProperties.description')}
          />
          <StatsCard
            title={t('dashboard.stats.occupancyRate.title')}
            value={`${occupancyRate}%`}
            icon={TrendingUp}
            description={t('dashboard.stats.occupancyRate.description')}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.recentBookings.title')}</CardTitle>
              <CardDescription>{t('dashboard.recentBookings.description')}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {recentBookings.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {t('dashboard.recentBookings.empty')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          {t('dashboard.recentBookings.columns.guest')}
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
                      {recentBookings.map((b) => (
                        <tr
                          key={b.id}
                          className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium">
                            {b.guest.firstName} {b.guest.lastName}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(b.checkInDate, i18n.language)}–
                            {formatDate(b.checkOutDate, i18n.language)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {b.currency ?? 'EUR'} {b.totalPrice.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={STATUS_VARIANT[b.status] ?? 'secondary'}>
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

          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.otaStatus.title')}</CardTitle>
              <CardDescription>{t('dashboard.otaStatus.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {(otaIntegrations ?? []).length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  {t('dashboard.otaStatus.empty')}
                </div>
              ) : (
                <div className="space-y-3">
                  {(otaIntegrations ?? []).map((integration) => {
                    const status = getOtaConnectionStatus(integration);
                    return (
                      <div key={integration.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {status === 'connected' && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          {status === 'warning' && (
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                          )}
                          {status === 'disconnected' && (
                            <Wifi className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium">
                            {PLATFORM_LABELS[integration.platform] ?? integration.platform}
                          </span>
                        </div>
                        <Badge
                          variant={
                            status === 'connected'
                              ? 'outline'
                              : status === 'warning'
                                ? 'secondary'
                                : 'destructive'
                          }
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
        </div>
      </div>
    </AppShell>
  );
}
