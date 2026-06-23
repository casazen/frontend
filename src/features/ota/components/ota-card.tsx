import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Settings, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { getOtaPlatformLabel, getSyncStatusLabel } from '@/lib/i18n-labels';
import { OTA_PLATFORM_COLORS, OTA_PLATFORM_ICONS, SYNC_STATUS_VARIANTS } from '../schemas/ota.schema';
import type { OtaIntegration } from '@/types';

interface OtaCardProps {
  integration: OtaIntegration;
  onSync?: (integration: OtaIntegration) => void;
  onEdit?: (integration: OtaIntegration) => void;
  onDelete?: (integration: OtaIntegration) => void;
  onValidate?: (integration: OtaIntegration) => void;
}

export function OtaCard({ integration, onSync, onEdit, onDelete, onValidate }: OtaCardProps) {
  const { t } = useTranslation();
  const platformColor = OTA_PLATFORM_COLORS[integration.platform] ?? '#888';
  const platformIcon = OTA_PLATFORM_ICONS[integration.platform] ?? '🏠';
  const platformLabel = getOtaPlatformLabel(integration.platform, t);
  const syncStatusConfig = integration.lastSyncStatus
    ? { variant: SYNC_STATUS_VARIANTS[integration.lastSyncStatus] ?? 'secondary', label: getSyncStatusLabel(integration.lastSyncStatus, t) }
    : null;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader
        className="p-4"
        style={{ borderTop: `4px solid ${platformColor}` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{platformIcon}</span>
            <div>
              <h3 className="font-semibold text-lg">{platformLabel}</h3>
              <p className="text-xs text-muted-foreground">Property: {integration.propertyId.slice(0, 8)}</p>
            </div>
          </div>
          <Badge variant={integration.isActive ? 'success' : 'secondary'}>
            {integration.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {integration.lastSyncAt && (
          <div>
            <p className="text-sm text-muted-foreground">Last Sync</p>
            <p className="font-medium text-sm">{formatDate(integration.lastSyncAt, 'PPp')}</p>
            {syncStatusConfig && (
              <Badge variant={syncStatusConfig.variant} className="mt-1">
                {syncStatusConfig.label}
              </Badge>
            )}
          </div>
        )}

        {integration.syncError && (
          <div className="rounded-lg bg-destructive/10 p-3">
            <div className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Sync Error</p>
                <p className="text-xs text-destructive/80 mt-1">{integration.syncError}</p>
              </div>
            </div>
          </div>
        )}

        {!integration.lastSyncAt && (
          <div className="text-sm text-muted-foreground">
            Never synced
          </div>
        )}

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Created {formatDate(integration.createdAt)}
          </p>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex flex-wrap gap-2">
        {onSync && integration.isActive && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSync(integration)}
            className="flex-1"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Sync Now
          </Button>
        )}
        {onValidate && (
          <Button variant="outline" size="sm" onClick={() => onValidate(integration)}>
            <CheckCircle className="h-4 w-4 mr-1" />
            Validate
          </Button>
        )}
        {onEdit && (
          <Button variant="outline" size="icon" onClick={() => onEdit(integration)}>
            <Settings className="h-4 w-4" />
          </Button>
        )}
        {onDelete && (
          <Button variant="outline" size="icon" onClick={() => onDelete(integration)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
