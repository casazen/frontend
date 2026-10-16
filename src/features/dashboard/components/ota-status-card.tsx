import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getOtaConnectionStatusLabel } from '@/lib/i18n-labels';
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

function getOtaConnectionStatus(integration: OtaIntegration): 'connected' | 'warning' | 'disconnected' {
  if (!integration.isActive) return 'disconnected';
  if (integration.lastSyncStatus === 'FAILED') return 'warning';
  return 'connected';
}

/** OTA partner channels: only with the `otaPartnerApi` flag on (D10). */
export function OtaStatusCard() {
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
                    <span className="text-sm font-medium">{PLATFORM_LABELS[integration.platform] ?? integration.platform}</span>
                  </div>
                  <Badge variant={status === 'connected' ? 'outline' : status === 'warning' ? 'secondary' : 'destructive'}>
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
