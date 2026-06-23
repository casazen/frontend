import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import i18n from '@/i18n/config';
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

function formatLastSync(lastSyncAt: string | undefined, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (!lastSyncAt) return t('ota.page.never');
  const date = new Date(lastSyncAt);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return t('ota.page.justNow');
  if (diffMins < 60) return t('ota.page.minAgo', { count: diffMins });
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return t('ota.page.hourAgo', { count: diffHours });
  return date.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
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

function OtaCard({ integration, t }: { integration: OtaIntegration; t: (key: string, options?: Record<string, unknown>) => string }) {
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
          <span className="text-muted-foreground">{t('ota.page.status')}</span>
          <Badge variant={statusVariant(connectionStatus)} className="capitalize">
            {t(`ota.status.${connectionStatus}`)}
          </Badge>
        </div>
        {integration.lastSyncStatus && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('ota.page.lastSyncStatus')}</span>
            <span className="text-xs font-medium">{integration.lastSyncStatus}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('ota.page.lastSync')}</span>
          <span className="text-muted-foreground">{formatLastSync(integration.lastSyncAt, t)}</span>
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
            {connectionStatus === 'disconnected' ? t('ota.page.connect') : t('ota.page.syncNow')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function OtaPage() {
  const { t } = useTranslation();
  const { data: integrations, isLoading, isError } = useOtaIntegrations();
  const syncAll = useSyncAllOta();

  function handleSyncAll() {
    syncAll.mutate();
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader title={t('ota.page.title')} description={t('ota.page.description')} />
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
            {t('ota.page.syncAll')}
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">{t('ota.page.loading')}</span>
          </div>
        )}

        {isError && (
          <div className="py-8 text-center text-destructive">
            {t('ota.page.error')}
          </div>
        )}

        {!isLoading && !isError && (integrations ?? []).length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            {t('ota.page.empty')}
          </div>
        )}

        {!isLoading && !isError && (integrations ?? []).length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(integrations ?? []).map((integration) => (
              <OtaCard key={integration.id} integration={integration} t={t} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
