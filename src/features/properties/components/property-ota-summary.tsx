import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Clock, CloudOff, Loader2, Network } from 'lucide-react';
import { InfoCard } from '@/components/shared/calm';
import { Badge } from '@/components/ui/badge';
import type { OtaIntegrationSummaryDto } from '@/types';
import { formatDateTime } from '@/lib/utils';

function SyncStatusIcon({ status }: { status: OtaIntegrationSummaryDto['syncStatus'] }) {
  switch (status) {
    case 'Success':
      return <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success-foreground" />;
    case 'Failed':
      return <AlertCircle aria-hidden="true" className="size-4 shrink-0 text-destructive" />;
    case 'InProgress':
      return <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin text-info-foreground motion-reduce:animate-none" />;
    case 'Pending':
      return <Clock aria-hidden="true" className="size-4 shrink-0 text-warning-foreground" />;
    default:
      return <Clock aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />;
  }
}

interface PropertyOtaSummaryProps {
  integrations: OtaIntegrationSummaryDto[];
}

export function PropertyOtaSummary({ integrations }: PropertyOtaSummaryProps) {
  const { t } = useTranslation();

  return (
    <InfoCard icon={Network} title={t('property.ota.title')} data-testid="property-ota-summary">
      {integrations.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CloudOff aria-hidden="true" className="size-4 shrink-0" />
          {t('property.ota.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {integrations.map((integration) => (
            <li key={integration.id} className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
              <span className="flex min-w-0 items-center gap-2 font-medium">
                <SyncStatusIcon status={integration.syncStatus} />
                <span className="min-w-0 break-words">{integration.platform}</span>
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                <Badge variant={integration.isActive ? 'success' : 'secondary'}>
                  {integration.isActive ? t('property.ota.active') : t('property.ota.inactive')}
                </Badge>
                {integration.syncEnabled && <Badge variant="outline">{t('property.ota.syncOn')}</Badge>}
              </span>
              <span className="basis-full text-xs text-muted-foreground">
                {t('property.ota.lastSync')} {integration.lastSyncAt ? formatDateTime(integration.lastSyncAt) : '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </InfoCard>
  );
}
