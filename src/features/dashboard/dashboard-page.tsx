import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { StatsCard } from './components/stats-card';
import { Home, Calendar, CreditCard, TrendingUp, Wifi, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const RECENT_BOOKINGS = [
  { guest: 'Marco Rossi', property: 'Villa Serena, Amalfi', dates: 'Jun 12–18', amount: '€1,250', status: 'confirmed' },
  { guest: 'Anna Bianchi', property: 'Casa Blu, Positano', dates: 'Jun 20–25', amount: '€980', status: 'pending' },
  { guest: 'Luca Ferrari', property: 'Apt Roma Centro', dates: 'Jun 22–26', amount: '€620', status: 'checked-in' },
  { guest: 'Sofia Greco', property: 'Villa Serena, Amalfi', dates: 'Jul 1–7', amount: '€1,750', status: 'confirmed' },
];

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  confirmed: 'default',
  pending: 'secondary',
  'checked-in': 'outline',
  cancelled: 'destructive',
};

const OTA_CHANNELS = [
  { name: 'Airbnb', status: 'connected', bookings: 8 },
  { name: 'Booking.com', status: 'connected', bookings: 5 },
  { name: 'Expedia', status: 'connected', bookings: 3 },
  { name: 'VRBO', status: 'warning', bookings: 2 },
  { name: 'TripAdvisor', status: 'connected', bookings: 4 },
  { name: 'Agoda', status: 'disconnected', bookings: 0 },
];

export function DashboardPage() {
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
            value="€15,234"
            icon={CreditCard}
            description="This month"
            trend={{ value: 18, isPositive: true }}
          />
          <StatsCard
            title="Active Bookings"
            value="24"
            icon={Calendar}
            description="This month"
            trend={{ value: 12, isPositive: true }}
          />
          <StatsCard
            title="Total Properties"
            value="5"
            icon={Home}
            description="Active properties"
            trend={{ value: 8, isPositive: true }}
          />
          <StatsCard
            title="Occupancy Rate"
            value="78%"
            icon={TrendingUp}
            description="Average this month"
            trend={{ value: 5, isPositive: true }}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Bookings</CardTitle>
              <CardDescription>Latest booking activity</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Guest</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Property</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Dates</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RECENT_BOOKINGS.map((b, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{b.guest}</td>
                        <td className="px-4 py-3 text-muted-foreground">{b.property}</td>
                        <td className="px-4 py-3 text-muted-foreground">{b.dates}</td>
                        <td className="px-4 py-3 text-right font-medium">{b.amount}</td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_VARIANT[b.status] ?? 'secondary'}>
                            {b.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>OTA Channel Status</CardTitle>
              <CardDescription>Sync status per platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {OTA_CHANNELS.map((ch) => (
                  <div key={ch.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {ch.status === 'connected' && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {ch.status === 'warning' && <AlertCircle className="h-4 w-4 text-yellow-500" />}
                      {ch.status === 'disconnected' && <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm font-medium">{ch.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{ch.bookings} bookings</span>
                      <Badge
                        variant={
                          ch.status === 'connected' ? 'outline'
                          : ch.status === 'warning' ? 'secondary'
                          : 'destructive'
                        }
                        className="capitalize"
                      >
                        {ch.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
