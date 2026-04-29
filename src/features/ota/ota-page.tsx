import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, XCircle, RefreshCw } from 'lucide-react';

const OTA_CHANNELS = [
  { name: 'Airbnb', status: 'connected', bookings: 8, lastSync: '2 min ago', revenue: 4500 },
  { name: 'Booking.com', status: 'connected', bookings: 5, lastSync: '5 min ago', revenue: 2800 },
  { name: 'Expedia', status: 'connected', bookings: 3, lastSync: '12 min ago', revenue: 1440 },
  { name: 'VRBO', status: 'warning', bookings: 2, lastSync: '1 hour ago', revenue: 2560 },
  { name: 'TripAdvisor', status: 'connected', bookings: 4, lastSync: '8 min ago', revenue: 1920 },
  { name: 'Agoda', status: 'disconnected', bookings: 0, lastSync: 'Never', revenue: 0 },
];

function StatusIcon({ status }: { status: string }) {
  if (status === 'connected') return <CheckCircle className="h-5 w-5 text-green-500" />;
  if (status === 'warning') return <AlertCircle className="h-5 w-5 text-yellow-500" />;
  return <XCircle className="h-5 w-5 text-muted-foreground" />;
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'connected') return 'default';
  if (status === 'warning') return 'secondary';
  return 'outline';
}

export function OtaPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader title="OTA Sync" description="Manage channel connections and sync status" />
          <Button variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync All
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {OTA_CHANNELS.map((ch) => (
            <Card key={ch.name}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base font-semibold">{ch.name}</CardTitle>
                <StatusIcon status={ch.status} />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={statusVariant(ch.status)} className="capitalize">
                    {ch.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Active bookings</span>
                  <span className="font-medium">{ch.bookings}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Revenue</span>
                  <span className="font-medium">€{ch.revenue.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last sync</span>
                  <span className="text-muted-foreground">{ch.lastSync}</span>
                </div>
                <div className="pt-1">
                  <Button
                    variant={ch.status === 'disconnected' ? 'default' : 'outline'}
                    size="sm"
                    className="w-full"
                  >
                    {ch.status === 'disconnected' ? 'Connect' : 'Sync now'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
