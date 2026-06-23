import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { BrainCircuit, ExternalLink } from 'lucide-react';
import {
  usePricingAdapterConfig,
  useSavePricingAdapterConfig,
  useDisablePricingAdapter,
  useTriggerPricingSync,
  usePricingHistory,
  usePricingPreview,
} from '@/queries/use-pricing-adapter';
import type { SavePricingAdapterConfigRequest } from '@/types';
import { PricingConfigCard } from './components/pricing-config-card';
import { PricingHistoryTable } from './components/pricing-history-table';
import { PricingPreviewSection } from './components/pricing-preview-section';

const PAGE_SIZE = 20;

export function PricingDashboardPage() {
  const { t } = useTranslation();
  const { id: propertyId } = useParams<{ id: string }>();

  // History filters state
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const historyFilters = {
    page,
    pageSize: PAGE_SIZE,
    ...(from && { from }),
    ...(to && { to }),
  };

  const { data: config, isLoading: isLoadingConfig } = usePricingAdapterConfig(propertyId!);
  const { data: history, isLoading: isLoadingHistory } = usePricingHistory(propertyId!, historyFilters);
  const { data: preview, isLoading: isLoadingPreview } = usePricingPreview(propertyId!);

  const saveConfig = useSavePricingAdapterConfig(propertyId!);
  const disableConfig = useDisablePricingAdapter(propertyId!);
  const triggerSync = useTriggerPricingSync(propertyId!);

  const isSaving = saveConfig.isPending || disableConfig.isPending;
  const isSyncing = triggerSync.isPending;

  function handleToggle(enabled: boolean) {
    if (enabled) {
      saveConfig.mutate({
        isEnabled: true,
        adaptationFrequency: config?.adaptationFrequency ?? 'daily',
        includeSeasonality: config?.includeSeasonality ?? true,
        includePublicHolidays: config?.includePublicHolidays ?? true,
      });
    } else {
      disableConfig.mutate();
    }
  }

  function handleSave(data: SavePricingAdapterConfigRequest) {
    saveConfig.mutate(data);
  }

  function handleFromChange(value: string) {
    setFrom(value);
    setPage(1);
  }

  function handleToChange(value: string) {
    setTo(value);
    setPage(1);
  }

  if (isLoadingConfig) {
    return <LoadingScreen message={t('pricing.dashboard.loading')} />;
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t('pricing.dashboard.title')}
          description={t('pricing.dashboard.description')}
        />

        {/* Configuration + Preview */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <PricingConfigCard
              config={config}
              isSaving={isSaving}
              isSyncing={isSyncing}
              onToggle={handleToggle}
              onSave={handleSave}
              onSync={() => triggerSync.mutate()}
            />
          </div>

          <div className="lg:col-span-2">
            {!config?.isEnabled ? (
              <EmptyState
                icon={BrainCircuit}
                title={t('pricing.dashboard.disabledTitle')}
                description={t('pricing.dashboard.disabledDescription')}
              />
            ) : isLoadingPreview ? (
              <div className="space-y-4">
                <Skeleton className="h-72 w-full rounded-lg" />
                <Skeleton className="h-48 w-full rounded-lg" />
              </div>
            ) : preview && preview.prices.length > 0 ? (
              <PricingPreviewSection prices={preview.prices} />
            ) : (
              <EmptyState
                icon={BrainCircuit}
                title={t('pricing.dashboard.noPreview')}
                description={t('pricing.dashboard.noPreviewDescription')}
              />
            )}
          </div>
        </div>

        {/* Price Adaptation History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('pricing.dashboard.historyTitle')}</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/properties/${propertyId}/pricing/history`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t('pricing.dashboard.fullHistory')}
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="history-from">{t('pricing.dashboard.from')}</Label>
                <Input
                  id="history-from"
                  type="date"
                  value={from}
                  onChange={(e) => handleFromChange(e.target.value)}
                  className="w-40"
                  data-testid="history-filter-from"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="history-to">{t('pricing.dashboard.to')}</Label>
                <Input
                  id="history-to"
                  type="date"
                  value={to}
                  onChange={(e) => handleToChange(e.target.value)}
                  className="w-40"
                  data-testid="history-filter-to"
                />
              </div>
            </div>

            <PricingHistoryTable
              data={history}
              isLoading={isLoadingHistory}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
