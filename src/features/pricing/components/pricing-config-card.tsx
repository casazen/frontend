import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { Label } from '@/components/ui/label';
import { RefreshCw, Save, Zap } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import type { PricingAdapterConfig } from '@/types';
import type { CreateOrUpdatePricingAdapterConfigRequest } from '@/types/pricing';

interface PricingConfigCardProps {
  config: PricingAdapterConfig | undefined;
  isSaving: boolean;
  isSyncing: boolean;
  onToggle: (enabled: boolean) => void;
  onSave: (data: CreateOrUpdatePricingAdapterConfigRequest) => void;
  onSync: () => void;
}

export function PricingConfigCard({
  config,
  isSaving,
  isSyncing,
  onToggle,
  onSave,
  onSync,
}: PricingConfigCardProps) {
  const { t } = useTranslation();
  const isEnabled = config?.isEnabled ?? false;

  // Local form state, synced from server data
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>(
    config?.adaptationFrequency ?? 'daily'
  );
  const [includeSeasonality, setIncludeSeasonality] = useState(
    config?.includeSeasonality ?? true
  );
  const [includePublicHolidays, setIncludePublicHolidays] = useState(
    config?.includePublicHolidays ?? true
  );

  // Sync local form state when server data changes
  useEffect(() => {
    if (config) {
      setFrequency(config.adaptationFrequency);
      setIncludeSeasonality(config.includeSeasonality);
      setIncludePublicHolidays(config.includePublicHolidays);
    }
  }, [config]);

  function handleSave() {
    onSave({
      isEnabled,
      adaptationFrequency: frequency,
      includeSeasonality,
      includePublicHolidays,
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <CardTitle>{t('pricing.config.title')}</CardTitle>
          </div>
          <Badge variant={isEnabled ? 'success' : 'secondary'}>
            {isEnabled ? t('pricing.config.active') : t('pricing.config.disabled')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable / disable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="pricing-toggle" className="text-sm font-medium">
              {t('pricing.config.enableLabel')}
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('pricing.config.enableDescription')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSaving && <Spinner className="h-4 w-4" />}
            <Switch
              id="pricing-toggle"
              checked={isEnabled}
              disabled={isSaving}
              onCheckedChange={onToggle}
              data-testid="pricing-toggle"
            />
          </div>
        </div>

        {/* Frequency selector */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('pricing.config.frequencyLabel')}</Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="frequency"
                value="daily"
                checked={frequency === 'daily'}
                onChange={() => setFrequency('daily')}
                className="accent-primary"
                data-testid="frequency-daily"
              />
              <span className="text-sm">{t('pricing.config.daily')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="frequency"
                value="weekly"
                checked={frequency === 'weekly'}
                onChange={() => setFrequency('weekly')}
                className="accent-primary"
                data-testid="frequency-weekly"
              />
              <span className="text-sm">{t('pricing.config.weekly')}</span>
            </label>
          </div>
        </div>

        {/* Checkboxes */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">{t('pricing.config.factorsLabel')}</Label>
          <div className="flex items-center gap-2">
            <Checkbox
              id="include-seasonality"
              checked={includeSeasonality}
              onCheckedChange={(checked) => setIncludeSeasonality(!!checked)}
              data-testid="include-seasonality"
            />
            <Label htmlFor="include-seasonality" className="text-sm cursor-pointer">
              {t('pricing.config.includeSeasonality')}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="include-public-holidays"
              checked={includePublicHolidays}
              onCheckedChange={(checked) => setIncludePublicHolidays(!!checked)}
              data-testid="include-public-holidays"
            />
            <Label htmlFor="include-public-holidays" className="text-sm cursor-pointer">
              {t('pricing.config.includePublicHolidays')}
            </Label>
          </div>
        </div>

        {/* Timestamps */}
        {config && (
          <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
            <div>
              <span className="text-muted-foreground text-xs">{t('pricing.config.lastRun')}</span>
              <p className="font-medium text-xs mt-0.5">
                {config.lastAdaptedAt
                  ? formatDateTime(config.lastAdaptedAt)
                  : '—'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">{t('pricing.config.nextRun')}</span>
              <p className="font-medium text-xs mt-0.5">
                {config.nextScheduledRunAt
                  ? formatDateTime(config.nextScheduledRunAt)
                  : '—'}
              </p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2 border-t pt-4">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full"
            data-testid="save-config-btn"
          >
            {isSaving ? (
              <Spinner className="mr-2 h-4 w-4" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isSaving ? t('pricing.config.saving') : t('pricing.config.save')}
          </Button>

          {isEnabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSync}
              disabled={isSyncing}
              className="w-full"
              data-testid="sync-btn"
            >
              {isSyncing ? (
                <Spinner className="mr-2 h-4 w-4" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {isSyncing ? t('pricing.config.syncing') : t('pricing.config.syncNow')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
