import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Label } from '@/components/ui/label';
import { RefreshCw, Zap } from 'lucide-react';
import type { PricingAdapterConfig } from '@/types';

interface PricingConfigCardProps {
  config: PricingAdapterConfig | undefined;
  isSaving: boolean;
  isSyncing: boolean;
  onToggle: (enabled: boolean) => void;
  onSync: () => void;
}

export function PricingConfigCard({
  config,
  isSaving,
  isSyncing,
  onToggle,
  onSync,
}: PricingConfigCardProps) {
  const isEnabled = config?.isEnabled ?? false;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <CardTitle>AI Dynamic Pricing</CardTitle>
          </div>
          <Badge variant={isEnabled ? 'success' : 'secondary'}>
            {isEnabled ? 'Active' : 'Disabled'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="pricing-toggle" className="text-sm font-medium">
              Enable AI pricing
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automatically adjusts nightly rates based on demand, season, and local events.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSaving && <Spinner className="h-4 w-4" />}
            <Switch
              id="pricing-toggle"
              checked={isEnabled}
              disabled={isSaving}
              onCheckedChange={onToggle}
            />
          </div>
        </div>

        {config && (
          <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
            <div>
              <span className="text-muted-foreground">Frequency</span>
              <p className="font-medium capitalize">{config.adaptationFrequency}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Last run</span>
              <p className="font-medium">
                {config.lastAdaptedAt
                  ? new Date(config.lastAdaptedAt).toLocaleDateString('it-IT')
                  : '—'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Next run</span>
              <p className="font-medium">
                {config.nextScheduledRunAt
                  ? new Date(config.nextScheduledRunAt).toLocaleDateString('it-IT')
                  : '—'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Seasonality</span>
              <p className="font-medium">{config.includeSeasonality ? 'On' : 'Off'}</p>
            </div>
          </div>
        )}

        {isEnabled && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={isSyncing}
            className="w-full"
          >
            {isSyncing ? (
              <Spinner className="mr-2 h-4 w-4" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {isSyncing ? 'Syncing...' : 'Run sync now'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
