import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { AlignedCard, CardTitle } from '@/components/ui/card';
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

interface OtaCardProps {
  integration: OtaIntegration;
  t: (key: string, options?: Record<string, unknown>) => string;
  /** Some integration of the list has a sync status / an error: every card keeps a row for it, empty where it has none. */
  showSyncStatus: boolean;
  showError: boolean;
}

function OtaCard({ integration, t, showSyncStatus, showError }: OtaCardProps) {
  const syncPlatform = useSyncOtaPlatform();
  const connectionStatus = getConnectionStatus(integration);
  // The rows, the same in all the cards of the list (`AlignedCard`): the name, the status, the last sync status (if any card has
  // one), the last sync, the error (if any card has one) and the button, which is always the last and at the same height.
  const rows = (4 + Number(showSyncStatus) + Number(showError)) as 4 | 5 | 6;

  function handleSync() {
    syncPlatform.mutate(integration.platform);
  }

  return (
    <AlignedCard rows={rows} from="md">
      <div className="mb-3 flex items-center justify-between">
        <CardTitle className="text-base font-semibold">
          {PLATFORM_LABELS[integration.platform] ?? integration.platform}
        </CardTitle>
        <StatusIcon status={connectionStatus} />
      </div>
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t('ota.page.status')}</span>
        <Badge variant={statusVariant(connectionStatus)} className="capitalize">
          {t(`ota.status.${connectionStatus}`)}
        </Badge>
      </div>
      {showSyncStatus &&
        (integration.lastSyncStatus ? (
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('ota.page.lastSyncStatus')}</span>
            <span className="text-xs font-medium">{integration.lastSyncStatus}</span>
          </div>
        ) : (
          <div />
        ))}
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t('ota.page.lastSync')}</span>
        <span className="text-muted-foreground">{formatLastSync(integration.lastSyncAt, t)}</span>
      </div>
      {showError &&
        (integration.syncError ? (
          <div className="mb-3 text-xs text-destructive bg-destructive/10 rounded p-2">
            {integration.syncError}
          </div>
        ) : (
          <div />
        ))}
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
    </AlignedCard>
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
              <OtaCard
                key={integration.id}
                integration={integration}
                t={t}
                showSyncStatus={(integrations ?? []).some((candidate) => candidate.lastSyncStatus)}
                showError={(integrations ?? []).some((candidate) => candidate.syncError)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
