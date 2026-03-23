import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { StatsCard } from './components/stats-card';
import { Home, Calendar, CreditCard, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
            title="Total Properties"
            value="12"
            icon={Home}
            description="Active properties"
            trend={{ value: 8, isPositive: true }}
          />
          <StatsCard
            title="Active Bookings"
            value="24"
            icon={Calendar}
            description="This month"
            trend={{ value: 12, isPositive: true }}
          />
          <StatsCard
            title="Revenue"
            value="€15,234"
            icon={CreditCard}
            description="This month"
            trend={{ value: 18, isPositive: true }}
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
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Connect to the backend API to see real booking data here.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue Overview</CardTitle>
              <CardDescription>Monthly revenue trends</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Connect to the backend API to see revenue charts here.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
