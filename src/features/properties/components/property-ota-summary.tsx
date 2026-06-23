import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { OtaIntegrationSummaryDto } from '@/types';
import { formatDateTime } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';

function SyncStatusIcon({ status }: { status: OtaIntegrationSummaryDto['syncStatus'] }) {
  switch (status) {
    case 'Success':
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case 'Failed':
      return <AlertCircle className="h-5 w-5 text-destructive" />;
    case 'InProgress':
      return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
    case 'Pending':
      return <Clock className="h-5 w-5 text-yellow-600" />;
    default:
      return <Clock className="h-5 w-5 text-muted-foreground" />;
  }
}

interface PropertyOtaSummaryProps {
  integrations: OtaIntegrationSummaryDto[];
}

export function PropertyOtaSummary({ integrations }: PropertyOtaSummaryProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('property.ota.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {integrations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('property.ota.empty')}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {integrations.map((integration) => (
              <div key={integration.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{integration.platform}</span>
                  <SyncStatusIcon status={integration.syncStatus} />
                </div>
                <div className="flex gap-2">
                  <Badge variant={integration.isActive ? 'success' : 'secondary'}>
                    {integration.isActive ? t('property.ota.active') : t('property.ota.inactive')}
                  </Badge>
                  {integration.syncEnabled && (
                    <Badge variant="outline">{t('property.ota.syncOn')}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('property.ota.lastSync')} {integration.lastSyncAt ? formatDateTime(integration.lastSyncAt) : '—'}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
