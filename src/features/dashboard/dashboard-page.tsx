import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { StatsCard } from './components/stats-card';
import { Home, Calendar, CreditCard, TrendingUp, Wifi, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useBookings } from '@/queries/use-bookings';
import { useProperties } from '@/queries/use-properties';
import { usePayments } from '@/queries/use-payments';
import { useOtaIntegrations } from '@/queries/use-ota';
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

const STATUS_LABELS: Record<string, string> = {
  Confirmed: 'confirmed',
  Pending: 'pending',
  CheckedIn: 'checked-in',
  CheckedOut: 'checked-out',
  Cancelled: 'cancelled',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function getOtaConnectionStatus(integration: OtaIntegration): 'connected' | 'warning' | 'disconnected' {
  if (!integration.isActive) return 'disconnected';
  if (integration.lastSyncStatus === 'FAILED') return 'warning';
  return 'connected';
}

export function DashboardPage() {
  const { data: bookings } = useBookings();
  const { data: properties } = useProperties();
  const { data: payments } = usePayments();
  const { data: otaIntegrations } = useOtaIntegrations();

  // Compute KPIs
  const totalRevenue = (payments ?? [])
    .filter((p) => p.status === 'Completed')
    .reduce((sum, p) => sum + p.amount, 0);

  const activeBookings = (bookings ?? []).filter(
    (b) => b.status === 'Confirmed' || b.status === 'CheckedIn'
  ).length;

  const totalProperties = (properties ?? []).length;

  // Occupancy: bookings checked-in / total properties (rough indicator)
  const checkedIn = (bookings ?? []).filter((b) => b.status === 'CheckedIn').length;
  const occupancyRate = totalProperties > 0
    ? Math.round((checkedIn / totalProperties) * 100)
    : 0;

  // Recent bookings (last 5)
  const recentBookings = [...(bookings ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          description="Welcome to CASAZEN - Your vacation property management platform"
        />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Revenue"
            value={`€${totalRevenue.toLocaleString()}`}
            icon={CreditCard}
            description="Completed payments"
          />
          <StatsCard
            title="Active Bookings"
            value={String(activeBookings)}
            icon={Calendar}
            description="Confirmed + checked in"
          />
          <StatsCard
            title="Total Properties"
            value={String(totalProperties)}
            icon={Home}
            description="Active properties"
          />
          <StatsCard
            title="Occupancy Rate"
            value={`${occupancyRate}%`}
            icon={TrendingUp}
            description="Currently checked in"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Bookings</CardTitle>
              <CardDescription>Latest booking activity</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {recentBookings.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No bookings yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Guest</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Dates</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentBookings.map((b) => (
                        <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">
                            {b.guest.firstName} {b.guest.lastName}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(b.checkInDate)}–{formatDate(b.checkOutDate)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {b.currency ?? 'EUR'} {b.totalPrice.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={STATUS_VARIANT[b.status] ?? 'secondary'} className="capitalize">
                              {STATUS_LABELS[b.status] ?? b.status}
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
              <CardTitle>OTA Channel Status</CardTitle>
              <CardDescription>Sync status per platform</CardDescription>
            </CardHeader>
            <CardContent>
              {(otaIntegrations ?? []).length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  No OTA integrations configured.
                </div>
              ) : (
                <div className="space-y-3">
                  {(otaIntegrations ?? []).map((integration) => {
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
                          variant={
                            status === 'connected' ? 'outline'
                            : status === 'warning' ? 'secondary'
                            : 'destructive'
                          }
                          className="capitalize"
                        >
                          {status}
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
