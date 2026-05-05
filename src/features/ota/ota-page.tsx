import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import { useOtaIntegrations, useSyncAllOta, useSyncOtaPlatform } from '@/queries/use-ota';
import type { OtaIntegration, OtaPlatform } from '@/types';

const PLATFORM_LABELS: Record<OtaPlatform, string> = {
  AIRBNB: 'Airbnb',
  BOOKING_COM: 'Booking.com',
  EXPEDIA: 'Expedia',
  VRBO: 'VRBO',
  TRIPADVISOR: 'TripAdvisor',
  AGODA: 'Agoda',
};

function getConnectionStatus(integration: OtaIntegration): 'connected' | 'warning' | 'disconnected' {
  if (!integration.isActive) return 'disconnected';
  if (integration.lastSyncStatus === 'FAILED') return 'warning';
  return 'connected';
}

function formatLastSync(lastSyncAt?: string): string {
  if (!lastSyncAt) return 'Never';
  const date = new Date(lastSyncAt);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function StatusIcon({ status }: { status: 'connected' | 'warning' | 'disconnected' }) {
  if (status === 'connected') return <CheckCircle className="h-5 w-5 text-green-500" />;
  if (status === 'warning') return <AlertCircle className="h-5 w-5 text-yellow-500" />;
  return <XCircle className="h-5 w-5 text-muted-foreground" />;
}

function statusVariant(status: 'connected' | 'warning' | 'disconnected'): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'connected') return 'default';
  if (status === 'warning') return 'secondary';
  return 'outline';
}

function OtaCard({ integration }: { integration: OtaIntegration }) {
  const syncPlatform = useSyncOtaPlatform();
  const connectionStatus = getConnectionStatus(integration);

  function handleSync() {
    syncPlatform.mutate(integration.platform);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold">
          {PLATFORM_LABELS[integration.platform] ?? integration.platform}
        </CardTitle>
        <StatusIcon status={connectionStatus} />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Status</span>
          <Badge variant={statusVariant(connectionStatus)} className="capitalize">
            {connectionStatus}
          </Badge>
        </div>
        {integration.lastSyncStatus && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Last sync status</span>
            <span className="text-xs font-medium">{integration.lastSyncStatus}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Last sync</span>
          <span className="text-muted-foreground">{formatLastSync(integration.lastSyncAt)}</span>
        </div>
        {integration.syncError && (
          <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
            {integration.syncError}
          </div>
        )}
        <div className="pt-1">
          <Button
            variant={connectionStatus === 'disconnected' ? 'default' : 'outline'}
            size="sm"
            className="w-full"
            disabled={syncPlatform.isPending}
            onClick={connectionStatus !== 'disconnected' ? handleSync : undefined}
          >
            {syncPlatform.isPending ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : null}
            {connectionStatus === 'disconnected' ? 'Connect' : 'Sync now'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function OtaPage() {
  const { data: integrations, isLoading, isError } = useOtaIntegrations();
  const syncAll = useSyncAllOta();

  function handleSyncAll() {
    syncAll.mutate();
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader title="OTA Sync" description="Manage channel connections and sync status" />
          <Button
            variant="outline"
            onClick={handleSyncAll}
            disabled={syncAll.isPending || isLoading}
          >
            {syncAll.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync All
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading OTA integrations...</span>
          </div>
        )}

        {isError && (
          <div className="py-8 text-center text-destructive">
            Failed to load OTA integrations. Please try again.
          </div>
        )}

        {!isLoading && !isError && (integrations ?? []).length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            No OTA integrations configured yet.
          </div>
        )}

        {!isLoading && !isError && (integrations ?? []).length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(integrations ?? []).map((integration) => (
              <OtaCard key={integration.id} integration={integration} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
